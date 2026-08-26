// src/app/api/comunas/route.ts
import { NextResponse } from "next/server";
import { getComunasGeoJSON } from "@/lib/geoData";

export async function GET() {
    try {
        const data = await getComunasGeoJSON();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[API Comunas] Error:", err);
        return NextResponse.json({ error: "Failed to fetch GeoJSON" }, { status: 500 });
    }
}
