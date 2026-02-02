// supabase/functions/admin-users/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const BUILD_TAG =
  "admin-users-2026-01-29_v11_unified_paged_no_getUserByEmail_create_idempotent_hard_delete_returns_userId";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Action = "list" | "create" | "update_role" | "remove_from_org" | "hard_delete";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "x-build-tag": BUILD_TAG,
    },
  });
}

function log(tag: string, data?: unknown) {
  try {
    console.log(`[admin-users] ${tag}`, data ? JSON.stringify(data) : "");
  } catch {
    console.log(`[admin-users] ${tag}`);
  }
}

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function isEmail(email: string) {
  const e = normalizeEmail(email);
  return e.includes("@") && e.split("@")[0].length > 0 && e.split("@")[1].includes(".");
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function pickRoleId(body: any): string | undefined {
  if (typeof body?.roleId === "string" && body.roleId.trim()) return body.roleId.trim();
  if (Array.isArray(body?.roleIds) && typeof body.roleIds[0] === "string" && body.roleIds[0].trim()) {
    return body.roleIds[0].trim();
  }
  if (typeof body?.role_id === "string" && body.role_id.trim()) return body.role_id.trim();
  return undefined;
}

async function readJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

const uniq = (arr: string[]) => Array.from(new Set(arr));

function looksLikeDuplicateAuthError(msg: string) {
  const m = String(msg || "").toLowerCase();
  return (
    m.includes("already") ||
    m.includes("exists") ||
    m.includes("registered") ||
    m.includes("duplicate")
  );
}

async function findAuthUserIdByEmailPaged(supabaseAdmin: any, email: string) {
  const target = normalizeEmail(email);
  const perPage = 200;
  let page = 1;

  // hard cap para evitar loops infinitos por errores
  for (let i = 0; i < 50; i++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`LIST_USERS_FAILED: ${error.message}`);

    const users = data?.users ?? [];
    const hit = users.find((u: any) => normalizeEmail(u?.email ?? "") === target);
    if (hit?.id) return hit.id;

    if (users.length < perPage) return null;
    page += 1;
  }

  return null;
}

async function ensureProfileEmailNotTakenByOtherId(supabaseAdmin: any, userId: string, email: string) {
  // Previene el caso: profiles tiene ese email, pero con otro id distinto
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,email")
    .ilike("email", email)
    .neq("id", userId)
    .limit(1);

  if (error) throw new Error(`PROFILE_DUP_CHECK_FAILED: ${error.message}`);
  if (Array.isArray(data) && data.length > 0) {
    return { ok: false as const, otherProfileId: data[0]?.id ?? null };
  }
  return { ok: true as const };
}

async function upsertProfile(supabaseAdmin: any, userId: string, email: string, fullName: string) {
  const { error } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    email,
    name: fullName || email.split("@")[0],
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`UPSERT_PROFILE_FAILED: ${error.message}`);
}

async function upsertUserOrgRole(
  supabaseAdmin: any,
  orgId: string,
  userId: string,
  roleId: string,
  callerId: string
) {
  const { error } = await supabaseAdmin
    .from("user_org_roles")
    .upsert(
      {
        user_id: userId,
        org_id: orgId,
        role_id: roleId,
        assigned_by: callerId,
        assigned_at: new Date().toISOString(),
      },
      { onConflict: "user_id,org_id" }
    );

  if (error) throw new Error(`ASSIGN_ROLE_FAILED: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const t0 = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(500, {
        error: "MISSING_ENV",
        required: ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
      });
    }

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { error: "UNAUTHORIZED", details: "Missing Bearer token" });
    }
    const token = authHeader.split(" ")[1];

    const body = await readJson(req);
    if (!body) return json(400, { error: "INVALID_JSON" });

    let action: Action | undefined = body.action;
    const orgId: string | undefined = body.orgId;
    const debug: boolean = Boolean(body.debug);

    if (action === ("update" as any)) action = "update_role";
    if (action === ("delete" as any)) action = "remove_from_org";

    if (!action || !orgId || !isUuid(orgId)) {
      return json(400, { error: "MISSING_FIELDS", required: ["action", "orgId(uuid)"] });
    }

    log("BOOT", { BUILD_TAG, action, orgId, debug });

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: userData, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !userData?.user) {
      log("INVALID_JWT", authError?.message);
      return json(401, { error: "INVALID_JWT" });
    }
    const caller = userData.user;

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const requiredAny: string[] =
      action === "list"
        ? ["admin.users.view"]
        : action === "create"
        ? ["admin.users.create"]
        : action === "update_role"
        ? ["admin.users.update", "admin.users.update_role"]
        : ["admin.users.delete"];

    const { data: uor, error: uorErr } = await supabaseAdmin
      .from("user_org_roles")
      .select("role_id")
      .eq("user_id", caller.id)
      .eq("org_id", orgId);

    if (uorErr) return json(500, { error: "ROLE_LOOKUP_FAILED", details: uorErr.message });
    if (!uor || uor.length === 0) return json(403, { error: "FORBIDDEN", details: "No role in org" });

    const roleIds = uniq((uor ?? []).map((r: any) => r.role_id).filter(Boolean));

    const { data: rp, error: rpErr } = await supabaseAdmin
      .from("role_permissions")
      .select("permissions!role_permissions_permission_id_fkey(name)")
      .in("role_id", roleIds);

    if (rpErr) return json(500, { error: "PERMISSION_LOOKUP_FAILED", details: rpErr.message });

    const permSet = new Set<string>();
    (rp ?? []).forEach((x: any) => {
      const name = x?.permissions?.name;
      if (name) permSet.add(name);
    });

    const hasAny = requiredAny.some((p) => permSet.has(p));
    if (!hasAny) {
      return json(403, {
        error: "FORBIDDEN",
        requiredAny,
        debug: debug
          ? {
              buildTag: BUILD_TAG,
              callerId: caller.id,
              orgId,
              action,
              callerRoleIds: roleIds,
              userPermissions: Array.from(permSet),
              ms: Date.now() - t0,
            }
          : undefined,
      });
    }

    // =========================
    // ACTIONS
    // =========================

    if (action === "list") {
      const { data: assignments, error: aErr } = await supabaseAdmin
        .from("user_org_roles")
        .select("user_id, role_id, roles(name)")
        .eq("org_id", orgId);

      if (aErr) return json(500, { error: "LIST_FAILED", details: aErr.message });

      const userIds = uniq((assignments ?? []).map((a: any) => a.user_id).filter(Boolean));
      if (userIds.length === 0) {
        return json(200, {
          ok: true,
          users: [],
          debug: debug ? { ms: Date.now() - t0, buildTag: BUILD_TAG } : undefined,
        });
      }

      const { data: profiles, error: pErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name, created_at")
        .in("id", userIds);

      if (pErr) return json(500, { error: "PROFILES_LOOKUP_FAILED", details: pErr.message });

      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      const users = (assignments ?? []).map((a: any) => {
        const p = profileMap.get(a.user_id);
        return {
          id: a.user_id,
          email: p?.email ?? null,
          full_name: p?.name ?? null,
          role_id: a.role_id,
          role_name: a.roles?.name ?? null,
          created_at: p?.created_at ?? null,
        };
      });

      return json(200, {
        ok: true,
        users,
        debug: debug ? { ms: Date.now() - t0, buildTag: BUILD_TAG } : undefined,
      });
    }

    if (action === "create") {
      const emailRaw: string | undefined = body.email;
      const password: string | undefined = body.password;
      const roleId = pickRoleId(body);

      const email = normalizeEmail(emailRaw ?? "");
      const fullName: string = String(body.full_name ?? "").trim();

      if (!email || !password || !roleId)
        return json(400, { error: "MISSING_FIELDS", required: ["email", "password", "roleId"] });
      if (!isEmail(email)) return json(400, { error: "INVALID_EMAIL" });
      if (!isUuid(roleId)) return json(400, { error: "INVALID_ROLE_ID" });

      // 1) Buscar por email (paginado real)
      let existingUserId: string | null = null;
      try {
        existingUserId = await findAuthUserIdByEmailPaged(supabaseAdmin, email);
      } catch (e: any) {
        log("WARN_find_by_email_failed", { message: String(e?.message ?? e) });
      }

      // 2) Si existe -> NO creamos auth user
      if (existingUserId) {
        // Validar que profiles no tenga ese email para otro id
        const dup = await ensureProfileEmailNotTakenByOtherId(supabaseAdmin, existingUserId, email);
        if (!dup.ok) {
          return json(409, {
            ok: false,
            error: "EMAIL_CONFLICT_IN_PROFILES",
            details: "Ese email ya está ligado a otro profile (id distinto).",
            otherProfileId: dup.otherProfileId,
          });
        }

        await upsertProfile(supabaseAdmin, existingUserId, email, fullName);
        await upsertUserOrgRole(supabaseAdmin, orgId, existingUserId, roleId, caller.id);

        return json(200, {
          ok: true,
          success: true,
          userId: existingUserId,
          user_id: existingUserId,
          alreadyExisted: true,
          createdNew: false,
          debug: debug ? { ms: Date.now() - t0, buildTag: BUILD_TAG } : undefined,
        });
      }

      // 3) Si no existe -> creamos auth user
      const { data: created, error: cuErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      // Si chocó por carrera (otro request lo creó), buscamos de nuevo y asignamos
      if (cuErr) {
        const msg = String(cuErr.message ?? "");
        const looksDup = looksLikeDuplicateAuthError(msg);

        if (looksDup) {
          const userId2 = await findAuthUserIdByEmailPaged(supabaseAdmin, email);
          if (userId2) {
            const dup = await ensureProfileEmailNotTakenByOtherId(supabaseAdmin, userId2, email);
            if (!dup.ok) {
              return json(409, {
                ok: false,
                error: "EMAIL_CONFLICT_IN_PROFILES",
                details: "Ese email ya está ligado a otro profile (id distinto).",
                otherProfileId: dup.otherProfileId,
              });
            }

            await upsertProfile(supabaseAdmin, userId2, email, fullName);
            await upsertUserOrgRole(supabaseAdmin, orgId, userId2, roleId, caller.id);

            return json(200, {
              ok: true,
              success: true,
              userId: userId2,
              user_id: userId2,
              alreadyExisted: true,
              createdNew: false,
              debug: debug ? { ms: Date.now() - t0, buildTag: BUILD_TAG, note: "duplicate->recovered" } : undefined,
            });
          }
        }

        return json(409, {
          ok: false,
          error: looksDup ? "DUPLICATE_EMAIL" : "CREATE_USER_FAILED",
          details: msg,
        });
      }

      const userId = created?.user?.id;
      if (!userId) return json(500, { error: "CREATE_USER_FAILED", details: "missing user id" });

      // 4) Validar profiles duplicado (por seguridad)
      const dup = await ensureProfileEmailNotTakenByOtherId(supabaseAdmin, userId, email);
      if (!dup.ok) {
        return json(409, {
          ok: false,
          error: "EMAIL_CONFLICT_IN_PROFILES",
          details: "Ese email ya está ligado a otro profile (id distinto).",
          otherProfileId: dup.otherProfileId,
        });
      }

      await upsertProfile(supabaseAdmin, userId, email, fullName);
      await upsertUserOrgRole(supabaseAdmin, orgId, userId, roleId, caller.id);

      return json(200, {
        ok: true,
        success: true,
        userId,
        user_id: userId,
        alreadyExisted: false,
        createdNew: true,
        debug: debug ? { ms: Date.now() - t0, buildTag: BUILD_TAG } : undefined,
      });
    }

    if (action === "update_role") {
      const userId: string | undefined = body.userId;
      const roleId = pickRoleId(body);

      if (!userId || !roleId) return json(400, { error: "MISSING_FIELDS", required: ["userId", "roleId"] });
      if (!isUuid(userId)) return json(400, { error: "INVALID_USER_ID" });
      if (!isUuid(roleId)) return json(400, { error: "INVALID_ROLE_ID" });

      await upsertUserOrgRole(supabaseAdmin, orgId, userId, roleId, caller.id);

      const emailRaw: string | undefined = body.email;
      const full_name: string | undefined = body.full_name;

      if (emailRaw || full_name) {
        const email = emailRaw ? normalizeEmail(emailRaw) : undefined;
        if (emailRaw && !isEmail(email ?? "")) return json(400, { error: "INVALID_EMAIL" });

        if (email) {
          const dup = await ensureProfileEmailNotTakenByOtherId(supabaseAdmin, userId, email);
          if (!dup.ok) {
            return json(409, { ok: false, error: "EMAIL_ALREADY_USED", otherProfileId: dup.otherProfileId });
          }
        }

        const { error: profErr } = await supabaseAdmin
          .from("profiles")
          .update({
            email: email ?? undefined,
            name: full_name ? String(full_name).trim() : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (profErr) log("profile_update_failed", { message: profErr.message });
      }

      return json(200, {
        ok: true,
        success: true,
        userId,
        user_id: userId,
        debug: debug ? { buildTag: BUILD_TAG } : undefined,
      });
    }

    if (action === "hard_delete") {
      const userId: string | undefined = body.userId;
      if (!userId) return json(400, { error: "MISSING_FIELDS", required: ["userId"] });
      if (!isUuid(userId)) return json(400, { error: "INVALID_USER_ID" });

      // 1) borrar accesos (si aplica)
      await supabaseAdmin.from("user_country_access").delete().eq("user_id", userId).eq("org_id", orgId);
      await supabaseAdmin.from("user_warehouse_access").delete().eq("user_id", userId).eq("org_id", orgId);

      // 2) borrar rol en la org
      await supabaseAdmin.from("user_org_roles").delete().eq("user_id", userId).eq("org_id", orgId);

      // 3) borrar profile (opcional, pero coherente)
      await supabaseAdmin.from("profiles").delete().eq("id", userId);

      // 4) borrar usuario de Auth (ESTO es lo que evita el “already registered”)
      const { error: delAuthErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (delAuthErr) return json(500, { error: "DELETE_AUTH_FAILED", details: delAuthErr.message });

      return json(200, {
        ok: true,
        success: true,
        userId,
        user_id: userId,
        hardDeleted: true,
        debug: debug ? { ms: Date.now() - t0, buildTag: BUILD_TAG } : undefined,
      });
    }

    if (action === "remove_from_org") {
      const userId: string | undefined = body.userId;
      if (!userId) return json(400, { error: "MISSING_FIELDS", required: ["userId"] });
      if (!isUuid(userId)) return json(400, { error: "INVALID_USER_ID" });

      const { error: delErr } = await supabaseAdmin
        .from("user_org_roles")
        .delete()
        .eq("user_id", userId)
        .eq("org_id", orgId);

      if (delErr) return json(500, { error: "REMOVE_FAILED", details: delErr.message });

      return json(200, {
        ok: true,
        success: true,
        userId,
        user_id: userId,
        debug: debug ? { ms: Date.now() - t0, buildTag: BUILD_TAG } : undefined,
      });
    }

    return json(400, { error: "UNKNOWN_ACTION", action });
  } catch (e: any) {
    console.error("[admin-users] FATAL", e);
    return json(500, { error: "INTERNAL_ERROR", details: String(e?.message ?? e) });
  }
});
