import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: any) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceKey) {
      return json(500, {
        success: false,
        error: "MISSING_ENV",
        missing: [
          !supabaseUrl ? "SUPABASE_URL" : null,
          !serviceKey ? "SUPABASE_SERVICE_ROLE_KEY" : null,
        ].filter(Boolean),
      });
    }

    // ✅ Leer Authorization (cualquier casing)
    const authHeader =
      req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";

    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json(401, { success: false, error: "No autorizado", details: "Missing Bearer token" });
    }

    const token = authHeader.split(" ")[1] ?? "";
    if (!token) {
      return json(401, { success: false, error: "No autorizado", details: "Empty token" });
    }

    // ✅ Cliente admin (RLS bypass)
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // ✅ Validar usuario con el token
    const supabaseUser = createClient(supabaseUrl, serviceKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();

    if (userErr || !userData?.user) {
      return json(401, {
        success: false,
        error: "No autorizado",
        details: userErr?.message ?? "no_user",
      });
    }

    const user = userData.user;

    // ⚠️ Recomendado: restringir esta función (mínimo)
    // Ejemplo: allowlist por email (ajustá a tu caso)
    // const allowed = ["tuemail@tuempresa.com"];
    // if (!allowed.includes(user.email ?? "")) return json(403, { success:false, error:"Forbidden" });

    // ====== TU LÓGICA ORIGINAL (igual) ======

    const newPermissions = [
      { name: "admin.users.create", description: "Crear y asignar usuarios a la organización", category: "Usuarios" },
      { name: "admin.users.delete", description: "Eliminar usuarios de la organización", category: "Usuarios" },
      { name: "admin.users.update_role", description: "Cambiar el rol de un usuario", category: "Usuarios" },
      { name: "admin.users.view", description: "Ver lista de usuarios de la organización", category: "Usuarios" },

      { name: "admin.roles.create", description: "Crear nuevos roles", category: "Roles" },
      { name: "admin.roles.update", description: "Editar roles existentes", category: "Roles" },
      { name: "admin.roles.delete", description: "Eliminar roles", category: "Roles" },
      { name: "admin.roles.view", description: "Ver lista de roles", category: "Roles" },

      { name: "admin.permissions.create", description: "Crear nuevos permisos", category: "Permisos" },
      { name: "admin.permissions.update", description: "Editar permisos existentes", category: "Permisos" },
      { name: "admin.permissions.delete", description: "Eliminar permisos existentes", category: "Permisos" },
      { name: "admin.permissions.view", description: "Ver lista de permisos", category: "Permisos" },

      { name: "admin.matrix.view", description: "Ver matriz de permisos", category: "Matriz de Permisos" },
      { name: "admin.matrix.update", description: "Modificar asignaciones en la matriz", category: "Matriz de Permisos" },
      { name: "admin.matrix.export", description: "Exportar matriz de permisos a CSV", category: "Matriz de Permisos" },
    ];

    const createdPermissions: any[] = [];
    const errors: any[] = [];

    for (const perm of newPermissions) {
      const { data: existing } = await supabaseAdmin
        .from("permissions")
        .select("id")
        .eq("name", perm.name)
        .maybeSingle();

      if (!existing) {
        const { data, error } = await supabaseAdmin
          .from("permissions")
          .insert(perm)
          .select()
          .single();

        if (error) {
          console.error("Error creando permiso:", perm.name, error);
          errors.push({ permission: perm.name, error: error.message });
        } else {
          createdPermissions.push(data);
        }
      }
    }

    const { data: adminRole } = await supabaseAdmin
      .from("roles")
      .select("id")
      .eq("name", "ADMIN")
      .maybeSingle();

    if (!adminRole) {
      return json(404, { success: false, error: "Rol ADMIN no encontrado" });
    }

    const { data: allAdminPermissions } = await supabaseAdmin
      .from("permissions")
      .select("id")
      .in("category", ["Usuarios", "Roles", "Permisos", "Matriz de Permisos", "Andenes", "Calendario", "Reservas", "Dashboard"]);

    const assignedPermissions: any[] = [];
    if (allAdminPermissions) {
      for (const perm of allAdminPermissions) {
        const { data: existing } = await supabaseAdmin
          .from("role_permissions")
          .select("id")
          .eq("role_id", adminRole.id)
          .eq("permission_id", perm.id)
          .maybeSingle();

        if (!existing) {
          const { data, error } = await supabaseAdmin
            .from("role_permissions")
            .insert({ role_id: adminRole.id, permission_id: perm.id })
            .select()
            .single();

          if (!error && data) assignedPermissions.push(data);
          else if (error) console.error("Error asignando permiso:", error);
        }
      }
    }

    return json(200, {
      success: true,
      caller: { id: user.id, email: user.email },
      created_permissions: createdPermissions.length,
      assigned_permissions: assignedPermissions.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("Error general:", error);
    return json(500, { success: false, error: error?.message ?? String(error) });
  }
});
