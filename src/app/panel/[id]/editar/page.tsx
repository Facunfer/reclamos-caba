// src/app/panel/[id]/editar/page.tsx
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import NuevoReclamoForm from "@/components/ui/NuevoReclamoForm";
import type { Reclamo, TipoReclamo } from "@/types";

export default async function EditarReclamoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("comuna_id")
    .eq("user_id", user.id)
    .single();

  if (!perfil) {
    return <div className="text-red-600">Error: perfil no encontrado.</div>;
  }

  // RLS ya limita la consulta a la comuna del usuario; el filtro explícito es
  // un segundo candado por si esa policy cambia.
  const { data: reclamo } = await supabase
    .from("reclamos")
    .select("*")
    .eq("id", id)
    .eq("comuna_id", perfil.comuna_id)
    .maybeSingle();

  if (!reclamo) notFound();

  const { data: tipos } = await supabase
    .from("tipos_reclamo")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <a href="/panel" className="text-indigo-600 text-sm hover:underline">← Volver al panel</a>
        <h1 className="text-2xl font-bold mt-2 text-gray-800">Editar Reclamo</h1>
        <p className="text-gray-500 text-sm">
          Comuna {String(perfil.comuna_id).padStart(2, "0")}
        </p>
      </div>

      <NuevoReclamoForm
        comunaId={perfil.comuna_id}
        userId={user.id}
        tipos={(tipos as TipoReclamo[]) ?? []}
        reclamo={reclamo as Reclamo}
      />
    </div>
  );
}
