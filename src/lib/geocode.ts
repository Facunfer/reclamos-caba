// src/lib/geocode.ts
// USIG Geocoder (GCABA) + Nominatim Fallback
const cache = new Map<string, { lat: number; lng: number; normalizada: string } | null>();
let lastCall = 0;
const RATE_MS = 1200; // Nominatim policy

export type USIGSuggestion = {
  direccion: string;
  coordenadas?: {
    x: string | number;
    y: string | number;
  };
  nombre_partido?: string;
};

export async function getSuggestionsUSIG(address: string): Promise<USIGSuggestion[]> {
  if (!address || address.length < 3) return [];
  try {
    const url = `https://servicios.usig.buenosaires.gob.ar/normalizar/?direccion=${encodeURIComponent(address)}&geocodificar=true&excluirFueraCABA=true&maxOptions=10`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    let suggestions: USIGSuggestion[] = data.direccionesNormalizadas || [];

    // Filtro local estricto para CABA
    return suggestions.filter(s => {
      const p = s.nombre_partido?.toUpperCase() || "";
      const d = s.direccion.toUpperCase();
      return p === "CABA" ||
        p.includes("CIUDAD AUTONOMA") ||
        p.includes("CAPITAL FEDERAL") ||
        d.endsWith(", CABA") ||
        d.includes("CIUDAD AUTONOMA DE BUENOS AIRES");
    });
  } catch (err) {
    console.error("[USIG] Suggestion error:", err);
    return [];
  }
}

export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number; normalizada: string } | null> {
  const key = address.trim().toLowerCase();
  if (cache.has(key)) return cache.get(key)!;

  try {
    // Intento 1: Normalizar + Geocodificar en un solo paso (USIG)
    const suggestions = await getSuggestionsUSIG(address);
    if (suggestions.length > 0) {
      const d = suggestions[0];
      // USIG Normalizar usa 'coordenadas' (x, y)
      if (d.coordenadas && d.coordenadas.x && d.coordenadas.y) {
        const result = {
          lat: typeof d.coordenadas.y === "string" ? parseFloat(d.coordenadas.y) : d.coordenadas.y,
          lng: typeof d.coordenadas.x === "string" ? parseFloat(d.coordenadas.x) : d.coordenadas.x,
          normalizada: d.direccion,
        };
        cache.set(key, result);
        return result;
      }
      address = d.direccion;
    }

    // Intento 2: Geocoder 2.2 de USIG (si el anterior no trajo coordenadas)
    const urlGeoUSIG = `https://servicios.usig.buenosaires.gob.ar/geocoder/2.2/geocoding/?q=${encodeURIComponent(address)}`;
    const resGeo = await fetch(urlGeoUSIG);
    if (resGeo.ok) {
      const dataGeo = await resGeo.json();
      if (dataGeo && typeof dataGeo === "object" && dataGeo.x && dataGeo.y) {
        const result = {
          lat: parseFloat(dataGeo.y),
          lng: parseFloat(dataGeo.x),
          normalizada: address,
        };
        cache.set(key, result);
        return result;
      }
    }

    // Fallback: Nominatim (con la dirección normalizada si fue posible)
    const now = Date.now();
    const wait = RATE_MS - (now - lastCall);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();

    const urlNom = new URL("https://nominatim.openstreetmap.org/search");
    urlNom.searchParams.set("q", `${address}, Ciudad Autónoma de Buenos Aires, Argentina`);
    urlNom.searchParams.set("format", "json");
    urlNom.searchParams.set("limit", "1");

    const resNom = await fetch(urlNom.toString(), {
      headers: { "User-Agent": "ReclamosCaba/1.0" },
    });
    if (resNom.ok) {
      const dataNom = await resNom.json();
      if (dataNom.length > 0) {
        const result = {
          lat: parseFloat(dataNom[0].lat),
          lng: parseFloat(dataNom[0].lon),
          normalizada: address,
        };
        cache.set(key, result);
        return result;
      }
    }

    cache.set(key, null);
    return null;
  } catch (err) {
    console.error("[geocode] error:", err);
    cache.set(key, null);
    return null;
  }
}
