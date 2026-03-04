// src/app/api/geocode/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getSuggestionsUSIG, geocodeAddress } from "@/lib/geocode";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const suggestions = req.nextUrl.searchParams.get("suggestions") === "true";

  if (!q) {
    return NextResponse.json({ error: "Missing q param" }, { status: 400 });
  }

  if (suggestions) {
    const list = await getSuggestionsUSIG(q);
    return NextResponse.json(list);
  }

  const result = await geocodeAddress(q);

  if (!result) {
    return NextResponse.json({ lat: null, lng: null, normalizada: null });
  }

  return NextResponse.json({
    lat: result.lat,
    lng: result.lng,
    normalizada: result.normalizada,
  });
}
