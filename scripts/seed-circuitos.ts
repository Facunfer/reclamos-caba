// scripts/seed-circuitos.ts
// Importa los polígonos de circuitos electorales de CABA a la tabla `circuitos`.
// Corre con Service Role (bypassa RLS) e invoca la RPC `import_circuito` (006_circuitos.sql),
// que convierte el GeoJSON a geometry(MultiPolygon,4326) e idempotentemente upsertea por `codigo`.
//
// Uso: npm run seed:circuitos
// Requiere: circuitos_caba.geojson en la raíz del proyecto (EPSG:4326) y la migración 006 aplicada.

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { getComunaForPoint, type Point } from "../src/lib/geofence";

// --- .env.local parser (mismo patrón que seed-users.ts) ---
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  });
}
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const GEOJSON_PATH = path.resolve(process.cwd(), "circuitos_caba.geojson");
// GeoJSON oficial de comunas (solo se usa como fallback si un circuito no trae id_comuna)
const COMUNAS_GEOJSON_URL =
  "https://cdn.buenosaires.gob.ar/datosabiertos/datasets/innovacion-transformacion-digital/comunas/comunas.geojson";

/** Centroide aproximado (promedio de vértices del anillo exterior) para el fallback. */
function centroid(geometry: any): Point | null {
  let ring: number[][] | null = null;
  if (geometry?.type === "Polygon") ring = geometry.coordinates?.[0];
  else if (geometry?.type === "MultiPolygon") ring = geometry.coordinates?.[0]?.[0];
  if (!ring || ring.length === 0) return null;
  let sx = 0, sy = 0;
  for (const [lng, lat] of ring) { sx += lng; sy += lat; }
  return { lat: sy / ring.length, lng: sx / ring.length };
}

async function main() {
  if (!fs.existsSync(GEOJSON_PATH)) {
    console.error(`❌ No se encontró ${GEOJSON_PATH}. Colocá el archivo circuitos_caba.geojson en la raíz.`);
    process.exit(1);
  }

  const geo = JSON.parse(fs.readFileSync(GEOJSON_PATH, "utf-8"));
  const features: any[] = geo.features ?? [];
  console.log(`🚀 Importando ${features.length} circuitos...`);

  let comunasGeo: any = null; // lazy: solo se descarga si hace falta el fallback
  let ok = 0, errores = 0, sinComuna = 0;

  for (const f of features) {
    const props = f.properties ?? {};
    const codigo = String(props.id_circuit ?? props.codigo ?? "").trim();
    const barrio = props.barrio ?? null;

    if (!codigo) { console.warn("⚠️ Feature sin id_circuit, salteado."); errores++; continue; }

    // Comuna: preferimos el dato del GeoJSON; si falta, lo derivamos por centroide.
    let comunaId = Number(props.id_comuna);
    if (!comunaId || comunaId < 1 || comunaId > 15) {
      if (!comunasGeo) {
        console.log("ℹ️ Algún circuito sin id_comuna: descargando GeoJSON de comunas para fallback...");
        comunasGeo = await fetch(COMUNAS_GEOJSON_URL).then((r) => r.json()).catch(() => null);
      }
      const c = centroid(f.geometry);
      comunaId = (c && comunasGeo ? getComunaForPoint(c, comunasGeo) : null) ?? 0;
    }

    if (!comunaId) {
      console.warn(`⚠️ Circuito ${codigo}: sin comuna asignable (revisión manual).`);
      sinComuna++;
      continue;
    }

    const { error } = await supabase.rpc("import_circuito", {
      p_codigo: codigo,
      p_barrio: barrio,
      p_comuna_id: comunaId,
      p_geojson: f.geometry,
    });

    if (error) {
      console.error(`❌ Circuito ${codigo}:`, error.message);
      errores++;
    } else {
      ok++;
    }
  }

  console.log("\n✨ Importación finalizada.");
  console.log(`   ✅ OK: ${ok}`);
  console.log(`   ⚠️ Sin comuna (no importados): ${sinComuna}`);
  console.log(`   ❌ Errores: ${errores}`);
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
