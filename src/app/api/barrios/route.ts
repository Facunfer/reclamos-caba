// src/app/api/barrios/route.ts
import { NextResponse } from "next/server";

const BARRIOS_URL = "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/barrios/barrios.geojson";

export async function GET() {
    try {
        const res = await fetch(BARRIOS_URL, {
            next: { revalidate: 86400 } // Cache for 24 hours
        });
        if (!res.ok) throw new Error("Failed to fetch barrios GeoJSON from source");
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[API Barrios] Error:", err);
        return NextResponse.json({ error: "Failed to fetch Barrios GeoJSON" }, { status: 500 });
    }
}
