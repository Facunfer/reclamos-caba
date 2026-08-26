import { NextResponse } from "next/server";
import { getReclamosUnificados } from "@/lib/reclamosUnificados";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    const body = await getReclamosUnificados();
    return NextResponse.json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[api/public/reclamos] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
