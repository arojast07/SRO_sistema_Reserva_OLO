// supabase/functions/admin-user-access/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BUILD_TAG = "admin-user-access-2026-01-28_v4_cors_and_perm_fix";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  // ✅ opcional pero útil para caches intermedios
  "Vary": "Origin",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "x-build-tag": BUILD_TAG,
    },
  });

function log(tag: string, data?: unknown) {
  try {
    console.log(`[admin-user-access] ${tag}`, data ? JSON.stringify(data) : "");
  } catch {
    console.log(`[admin-user-access] ${tag}`);
  }
}

serve(async (req) => {
  // ✅ CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "METHOD_NOT_ALLOWED" });
  }

  const t0 = Date.now();
  log("BOOT", { BUILD_TAG });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, {
        error: "MISSING_ENV_VARS",
        required: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      });
    }

    const authHeader =
      req.headers.get("authorization") ??
      req.headers.get("Authorization") ??
      "";

    // ✅ soporta Bearer / bearer
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { error: "MISSING_BEARER_TOKEN" });
    }

    const accessToken = authHeader.split(" ")[1];

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data: authData, error: authError } =
      await supabaseAuth.auth.getUser(accessToken);

    if (authError || !authData?.user) {
      log("INVALID_JWT", authError?.message);
      return json(401, { error: "INVALID_JWT" });
    }

    const caller = authData.user;
    log("AUTHENTICATED", { userId: caller.id });

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const body = await req.json().catch(() => null);
    if (!body) return json(400, { error: "INVALID_JSON" });

    const { action, orgId, targetUserId, debug } = body;

    if (!action || !orgId || !targetUserId) {
      return json(400, {
        error: "MISSING_FIELDS",
        required: ["action", "orgId", "targetUserId"],
      });
    }

    log("REQUEST", { action, orgId, targetUserId, callerId: caller.id });

    // =========================
    // ✅ PERMISSION CHECK (ajustado a tus permisos reales)
    // =========================
    const { data: userOrgRoles, error: uorErr } = await supabaseAdmin
      .from("user_org_roles")
      .select("role_id")
      .eq("user_id", caller.id)
      .eq("org_id", orgId);

    if (uorErr) {
      log("ROLE_LOOKUP_FAILED", uorErr.message);
      return json(500, { error: "ROLE_LOOKUP_FAILED", details: uorErr.message });
    }

    if (!userOrgRoles || userOrgRoles.length === 0) {
      log("NO_ROLE_IN_ORG", { userId: caller.id, orgId });

      if (debug) {
        return json(403, {
          error: "FORBIDDEN_NOT_ADMIN",
          debug: {
            buildTag: BUILD_TAG,
            requesterUserId: caller.id,
            orgId,
            decision: "DENY",
            reason: "User has no role in organization",
            ms: Date.now() - t0,
          },
        });
      }

      return json(403, { error: "FORBIDDEN_NOT_ADMIN" });
    }

    const roleIds = userOrgRoles.map((r: any) => r.role_id);
    log("USER_ROLES", { roleIds });

    const { data: rolePermissions, error: rpErr } = await supabaseAdmin
      .from("role_permissions")
      .select("permission_id, permissions(name)")
      .in("role_id", roleIds);

    if (rpErr) {
      log("PERMISSION_LOOKUP_FAILED", rpErr.message);
      return json(500, { error: "PERMISSION_LOOKUP_FAILED", details: rpErr.message });
    }

    const permSet = new Set<string>();
    (rolePermissions ?? []).forEach((x: any) => {
      const name = x?.permissions?.name;
      if (name) permSet.add(name);
    });

    const permissionsArray = Array.from(permSet);
    log("USER_PERMISSIONS", { permissions: permissionsArray });

    // ✅ permisos reales esperados
    const requiredAny = [
      "admin.users.assign_access",
      "admin.users.assign_roles",
      "admin.users.view",
      "admin.users.update",
    ];

    const hasPermission = requiredAny.some((perm) => permSet.has(perm));

    if (!hasPermission) {
      log("PERMISSION_DENIED", { requiredAny, has: permissionsArray });

      if (debug) {
        return json(403, {
          error: "FORBIDDEN_NOT_ADMIN",
          debug: {
            buildTag: BUILD_TAG,
            requesterUserId: caller.id,
            orgId,
            permissionsChecked: requiredAny,
            userPermissions: permissionsArray,
            decision: "DENY",
            reason: "User lacks required permissions",
            ms: Date.now() - t0,
          },
        });
      }

      return json(403, { error: "FORBIDDEN_NOT_ADMIN" });
    }

    log("PERMISSION_GRANTED", {
      grantedBy: permissionsArray.filter((p) => requiredAny.includes(p)),
    });

    // =========================
    // ACTION: GET
    // =========================
    if (action === "get") {
      const { data: countries, error: cErr } = await supabaseAdmin
        .from("user_country_access")
        .select("country_id")
        .eq("org_id", orgId)
        .eq("user_id", targetUserId);

      if (cErr) {
        log("GET_COUNTRIES_FAILED", cErr.message);
        return json(500, { error: "GET_COUNTRIES_FAILED", details: cErr.message });
      }

      const { data: warehouses, error: wErr } = await supabaseAdmin
        .from("user_warehouse_access")
        .select("warehouse_id")
        .eq("org_id", orgId)
        .eq("user_id", targetUserId);

      if (wErr) {
        log("GET_WAREHOUSES_FAILED", wErr.message);
        return json(500, { error: "GET_WAREHOUSES_FAILED", details: wErr.message });
      }

      const result = {
        countryIds: (countries ?? []).map((c: any) => c.country_id),
        warehouseIds: (warehouses ?? []).map((w: any) => w.warehouse_id),
        restricted: (warehouses ?? []).length > 0,
      };

      log("GET_SUCCESS", {
        targetUserId,
        countriesCount: result.countryIds.length,
        warehousesCount: result.warehouseIds.length,
        ms: Date.now() - t0,
      });

      if (debug) {
        return json(200, {
          ...result,
          debug: {
            buildTag: BUILD_TAG,
            requesterUserId: caller.id,
            orgId,
            decision: "ALLOW",
            ms: Date.now() - t0,
          },
        });
      }

      return json(200, result);
    }

    // =========================
    // ACTION: SET_COUNTRIES
    // =========================
    if (action === "set_countries") {
      const countryIds: string[] = Array.isArray(body.countryIds) ? body.countryIds : [];

      log("SET_COUNTRIES_START", { targetUserId, countryIds });

      const { error: delErr } = await supabaseAdmin
        .from("user_country_access")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", targetUserId);

      if (delErr) {
        log("DELETE_COUNTRIES_FAILED", delErr.message);
        return json(500, { error: "DELETE_COUNTRIES_FAILED", details: delErr.message });
      }

      if (countryIds.length) {
        const { error: insErr } = await supabaseAdmin
          .from("user_country_access")
          .insert(
            countryIds.map((id) => ({
              org_id: orgId,
              user_id: targetUserId,
              country_id: id,
            }))
          );

        if (insErr) {
          log("INSERT_COUNTRIES_FAILED", {
            message: insErr.message,
            code: (insErr as any).code,
            hint: (insErr as any).hint,
            details: (insErr as any).details,
          });

          return json(500, {
            error: "INSERT_COUNTRIES_FAILED",
            message: insErr.message,
            code: (insErr as any).code,
            hint: (insErr as any).hint,
            details: (insErr as any).details,
          });
        }
      }

      // UI/Regla: si cambian países, limpiamos warehouses
      const { error: delWhErr } = await supabaseAdmin
        .from("user_warehouse_access")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", targetUserId);

      if (delWhErr) {
        log("DELETE_WAREHOUSES_FAILED", delWhErr.message);
        return json(500, { error: "DELETE_WAREHOUSES_FAILED", details: delWhErr.message });
      }

      log("SET_COUNTRIES_SUCCESS", {
        targetUserId,
        countriesCount: countryIds.length,
        ms: Date.now() - t0,
      });

      return json(200, { success: true });
    }

    // =========================
    // ACTION: SET_WAREHOUSES
    // =========================
    if (action === "set_warehouses") {
      const restricted = Boolean(body.restricted);
      const warehouseIds: string[] = Array.isArray(body.warehouseIds) ? body.warehouseIds : [];

      log("SET_WAREHOUSES_START", { targetUserId, restricted, warehouseIds });

      const { error: delErr } = await supabaseAdmin
        .from("user_warehouse_access")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", targetUserId);

      if (delErr) {
        log("DELETE_WAREHOUSES_FAILED", delErr.message);
        return json(500, { error: "DELETE_WAREHOUSES_FAILED", details: delErr.message });
      }

      if (restricted && warehouseIds.length) {
        const { error: insErr } = await supabaseAdmin
          .from("user_warehouse_access")
          .insert(
            warehouseIds.map((id) => ({
              org_id: orgId,
              user_id: targetUserId,
              warehouse_id: id,
            }))
          );

        if (insErr) {
          log("INSERT_WAREHOUSES_FAILED", {
            message: insErr.message,
            code: (insErr as any).code,
            hint: (insErr as any).hint,
            details: (insErr as any).details,
          });

          return json(500, {
            error: "INSERT_WAREHOUSES_FAILED",
            message: insErr.message,
            code: (insErr as any).code,
            hint: (insErr as any).hint,
            details: (insErr as any).details,
          });
        }
      }

      log("SET_WAREHOUSES_SUCCESS", {
        targetUserId,
        restricted,
        warehousesCount: restricted ? warehouseIds.length : 0,
        ms: Date.now() - t0,
      });

      return json(200, { success: true });
    }

    return json(400, { error: "UNKNOWN_ACTION", action });
  } catch (e: any) {
    console.error("[admin-user-access] FATAL", e);
    return json(500, { error: "INTERNAL_ERROR", details: String(e?.message ?? e) });
  }
});
