// src/app/api/reclamos/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supabase = await createClient();

  // Build filters for reclamos_publicos view
  let query = supabase.from("reclamos_publicos").select("tipo_reclamo, created_at, urgencia, estado, comuna_id");

  const comuna = sp.get("comuna");
  const tipo = sp.get("tipo");
  const urgencia = sp.get("urgencia");
  const estado = sp.get("estado");
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");

  if (comuna) query = query.eq("comuna_id", parseInt(comuna));
  if (tipo) query = query.eq("tipo_reclamo", tipo);
  if (urgencia) query = query.eq("urgencia", urgencia);
  if (estado) query = query.eq("estado", estado);
  if (desde) query = query.gte("created_at", desde);
  if (hasta) query = query.lte("created_at", hasta + "T23:59:59");

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by tipo
  const barrasMap = new Map<string, number>();
  const lineaMap = new Map<string, number>();

  for (const row of data ?? []) {
    barrasMap.set(row.tipo_reclamo, (barrasMap.get(row.tipo_reclamo) ?? 0) + 1);
    const fecha = row.created_at?.slice(0, 10) ?? "";
    lineaMap.set(fecha, (lineaMap.get(fecha) ?? 0) + 1);
  }

  const barras = Array.from(barrasMap.entries())
    .map(([tipo_reclamo, total]) => ({ tipo_reclamo, total }))
    .sort((a, b) => b.total - a.total);

  const linea = Array.from(lineaMap.entries())
    .map(([fecha, total]) => ({ fecha, total }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  return NextResponse.json({ barras, linea });
}
