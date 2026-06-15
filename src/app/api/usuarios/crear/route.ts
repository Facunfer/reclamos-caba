// src/app/api/usuarios/crear/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  // 1. Verificar que el usuario solicitante está autenticado y tiene can_create_users
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("comuna_id, can_create_users")
    .eq("user_id", user.id)
    .single();

  if (!perfil?.can_create_users) {
    return NextResponse.json({ error: "Sin permiso para crear usuarios" }, { status: 403 });
  }

  // 2. Leer body
  const { email, password, nombre, telefono } = await req.json();

  if (!email || !password || !nombre || !telefono) {
    return NextResponse.json({ error: "Todos los campos son obligatorios" }, { status: 400 });
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  }

  // 3. Crear usuario con service role (Admin API)
  // Usamos createAdminClient directamente para bypassear RLS sin interferencia de cookies
  const serviceClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (createError) {
    const msg = createError.message.includes("already registered")
      ? "Ya existe un usuario con ese email"
      : createError.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // 4. Crear perfil del nuevo usuario en la misma comuna, SIN permiso de crear usuarios
  const { error: perfilError } = await serviceClient
    .from("perfiles")
    .insert({
      user_id: newUser.user.id,
      comuna_id: perfil.comuna_id,
      role: "comuna",
      can_create_users: false,
      is_master: false,
      created_by: user.id,
      nombre,
      telefono,
      email,
    });

  if (perfilError) {
    // Rollback: eliminar el usuario Auth que acabamos de crear
    await serviceClient.auth.admin.deleteUser(newUser.user.id);
    return NextResponse.json({ error: "Error al crear el perfil: " + perfilError.message }, { status: 500 });
  }

  revalidatePath("/panel/usuarios");
  return NextResponse.json({ ok: true, user_id: newUser.user.id });
}
