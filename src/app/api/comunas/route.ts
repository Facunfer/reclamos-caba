// src/app/api/comunas/route.ts
import { NextResponse } from "next/server";

const COMUNAS_URL = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/comunas/comunas.geojson";

export async function GET() {
    try {
        const res = await fetch(COMUNAS_URL, {
            next: { revalidate: 86400 } // Cache for 24 hours
        });
        if (!res.ok) throw new Error("Failed to fetch comunas GeoJSON from source");
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[API Comunas] Error:", err);
        return NextResponse.json({ error: "Failed to fetch GeoJSON" }, { status: 500 });
    }
}
