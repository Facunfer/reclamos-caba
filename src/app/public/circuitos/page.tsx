// src/app/public/circuitos/page.tsx
import { createClient } from "@/lib/supabase/server";
import PublicCircuitosClient from "@/components/PublicCircuitosClient";
import type { ProblemaCircuitoPublico } from "@/types";
import Link from "next/link";
import LogoutButton from "@/components/ui/LogoutButton";

export const revalidate = 300;

export default async function PublicCircuitosPage() {
  const supabase = await createClient();

  const [{ data: geojson }, { data: problemas }] = await Promise.all([
    supabase.rpc("circuitos_featurecollection", { p_comuna_id: null }),
    supabase.from("problemas_circuito_publicos").select("*").order("created_at", { ascending: false }),
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-700 text-white py-3 px-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="font-bold text-lg">Circuitos CABA – Mapa Público</h1>
            <p className="text-indigo-200 text-xs">Ciudad Autónoma de Buenos Aires</p>
          </div>
          <nav className="hidden md:flex gap-4 fade-in">
            <Link href="/public" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Reclamos</Link>
            <Link href="/public/sugerencias" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Sugerencias</Link>
            <Link href="/public/circuitos" className="text-white bg-white/20 transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg border border-white/30 shadow-sm">Circuitos</Link>
            <Link href="/public/comunas" className="text-indigo-200 hover:text-white transition-colors text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-white/10">Usuarios</Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LogoutButton />
          <Link href="/login" className="text-sm bg-white text-indigo-700 px-3 py-1.5 rounded-lg font-semibold hover:bg-indigo-50">
            Panel comunal
          </Link>
        </div>
      </header>
      {/* Mobile nav */}
      <nav className="md:hidden flex bg-indigo-800 text-white text-sm">
        <Link href="/public" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Reclamos</Link>
        <Link href="/public/sugerencias" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Sugerencias</Link>
        <Link href="/public/circuitos" className="flex-1 py-2 text-center bg-white/20 font-bold border-b-2 border-white">Circuitos</Link>
        <Link href="/public/comunas" className="flex-1 py-2 text-center text-indigo-200 hover:bg-white/10">Usuarios</Link>
      </nav>

      <main className="flex-1 flex flex-col">
        <PublicCircuitosClient
          geojson={geojson ?? { type: "FeatureCollection", features: [] }}
          problemas={(problemas as ProblemaCircuitoPublico[]) ?? []}
        />
      </main>
    </div>
  );
}
