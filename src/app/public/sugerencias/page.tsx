import { createClient } from "@/lib/supabase/server";
import PublicSugerenciasClient from "@/components/PublicSugerenciasClient";
import type { SugerenciaPublica, TipoSugerencia } from "@/types";
import PublicHeader from "@/components/ui/PublicHeader";

export const revalidate = 60;

export default async function PublicSugerenciasPage() {
    const supabase = await createClient();

    const { data: tipos } = await supabase
        .from("tipos_sugerencia")
        .select("id, nombre, descripcion")
        .eq("activo", true)
        .order("nombre");

    const { data: sugerencias } = await supabase
        .from("sugerencias_publicas")
        .select("*")
        .order("created_at", { ascending: false });

    return (
        <div className="min-h-screen flex flex-col">
            <PublicHeader active="sugerencias" titulo="Sugerencias CABA – Mapa Público" />
            <main className="flex-1 flex flex-col">
                <PublicSugerenciasClient
                    initialSugerencias={(sugerencias as SugerenciaPublica[]) ?? []}
                    tipos={(tipos as TipoSugerencia[]) ?? []}
                />
            </main>
        </div>
    );
}
