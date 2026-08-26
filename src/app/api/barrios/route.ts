// src/app/api/barrios/route.ts
import { NextResponse } from "next/server";
import { getBarriosGeoJSON } from "@/lib/geoData";

export async function GET() {
    try {
        const data = await getBarriosGeoJSON();
        return NextResponse.json(data);
    } catch (err) {
        console.error("[API Barrios] Error:", err);
        return NextResponse.json({ error: "Failed to fetch Barrios GeoJSON" }, { status: 500 });
    }
}
