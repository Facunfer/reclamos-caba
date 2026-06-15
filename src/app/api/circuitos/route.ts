// src/app/api/circuitos/route.ts
// Devuelve un FeatureCollection GeoJSON de circuitos electorales.
//   - sin params  -> todos los circuitos (dashboard master)
//   - ?comuna_id=N -> solo los de esa comuna (panel comunal)
// Usa la RPC circuitos_featurecollection (006_circuitos.sql), que arma el GeoJSON con ST_AsGeoJSON.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Los circuitos casi no cambian: cache larga.
export const revalidate = 86400;

export async function GET(req: NextRequest) {
  const comunaParam = req.nextUrl.searchParams.get("comuna_id");
  const comunaId = comunaParam ? parseInt(comunaParam, 10) : null;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("circuitos_featurecollection", {
    p_comuna_id: Number.isFinite(comunaId as number) ? comunaId : null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? { type: "FeatureCollection", features: [] });
}
