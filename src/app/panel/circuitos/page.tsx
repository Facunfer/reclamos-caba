// src/app/panel/circuitos/page.tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CircuitosPanelClient from "@/components/CircuitosPanelClient";
import type { TipoReclamo } from "@/types";

export default async function CircuitosPanelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: perfil }, { data: tipos }] = await Promise.all([
    supabase.from("perfiles").select("comuna_id").eq("user_id", user.id).single(),
    // Mismo catálogo que los reclamos, para que el desplegable ofrezca las mismas opciones.
    supabase.from("tipos_reclamo").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  if (!perfil) {
    return <div className="text-red-600 p-4">Error: No se encontró perfil para este usuario.</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">
          Circuitos – Comuna {String(perfil.comuna_id).padStart(2, "0")}
        </h1>
        <span className="text-sm text-muted">Seleccioná un circuito en el mapa</span>
      </div>

      <CircuitosPanelClient
        comunaId={perfil.comuna_id}
        userId={user.id}
        tipos={(tipos as TipoReclamo[]) ?? []}
      />
    </div>
  );
}
