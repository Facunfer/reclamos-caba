// src/app/public/circuitos/page.tsx
import { createClient } from "@/lib/supabase/server";
import PublicCircuitosClient from "@/components/PublicCircuitosClient";
import type { ProblemaCircuitoPublico } from "@/types";
import PublicHeader from "@/components/ui/PublicHeader";

export const revalidate = 300;

export default async function PublicCircuitosPage() {
  const supabase = await createClient();

  const [{ data: geojson }, { data: problemas }] = await Promise.all([
    supabase.rpc("circuitos_featurecollection", { p_comuna_id: null }),
    supabase.from("problemas_circuito_publicos").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader active="circuitos" titulo="Circuitos CABA – Mapa Público" />

      <main className="flex-1 flex flex-col">
        <PublicCircuitosClient
          geojson={geojson ?? { type: "FeatureCollection", features: [] }}
          problemas={(problemas as ProblemaCircuitoPublico[]) ?? []}
        />
      </main>
    </div>
  );
}
