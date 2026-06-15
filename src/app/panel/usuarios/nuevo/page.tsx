// src/app/panel/usuarios/nuevo/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NuevoUsuarioForm from "@/components/ui/NuevoUsuarioForm";

export default async function NuevoUsuarioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("comuna_id, can_create_users")
    .eq("user_id", user.id)
    .single();

  if (!perfil?.can_create_users) {
    redirect("/panel");
  }

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Nuevo Usuario</h1>
        <p className="text-muted text-xs mt-1">
          Se creará en Comuna {String(perfil.comuna_id).padStart(2, "0")} sin permiso para crear otros usuarios.
        </p>
      </div>
      <NuevoUsuarioForm comunaId={perfil.comuna_id} />
    </div>
  );
}
