// Fuente única de las URLs de GeoJSON oficiales de la Ciudad. Usado tanto
// por los proxies /api/comunas y /api/barrios (consumidos por el cliente)
// como por /api/public/reclamos (que necesita point-in-polygon server-side).

const COMUNAS_URL =
  "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/comunas/comunas.geojson";
const BARRIOS_URL =
  "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/barrios/barrios.geojson";

export async function getComunasGeoJSON(): Promise<any> {
  const res = await fetch(COMUNAS_URL, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error("No se pudo obtener el GeoJSON de comunas");
  return res.json();
}

export async function getBarriosGeoJSON(): Promise<any> {
  const res = await fetch(BARRIOS_URL, { next: { revalidate: 86400 } });
  if (!res.ok) throw new Error("No se pudo obtener el GeoJSON de barrios");
  return res.json();
}
