// Agregación server-only del dataset unificado (reclamos nativos + MTR).
// Vive acá y no dentro del route handler para que el Server Component de
// /public pueda usar la misma lógica sin pegarle a su propia API por HTTP.
//
// IMPORTANTE: server-only. Lee SUPABASE_SERVICE_ROLE_KEY y, vía @/lib/mtr,
// MTR_SUPABASE_SERVICE_KEY. Nunca importar desde un componente cliente.

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { fetchMtrClaims, fetchMtrClaimPhotos, mapClaimToUnificado } from "@/lib/mtr";
import { getComunasGeoJSON, getBarriosGeoJSON } from "@/lib/geoData";
import { getComunaForPoint, getBarrioForPoint, type Point } from "@/lib/geofence";
import type {
  ReclamoArchivo,
  ReclamoPublico,
  ReclamoUnificado,
  ReclamosUnificadosResponse,
} from "@/types";

function mapNativoToUnificado(r: ReclamoPublico): ReclamoUnificado {
  return {
    id: `mapa:${r.id}`,
    origen: "mapa",
    tipo: r.tipo_reclamo,
    subtipo: r.subtipo ?? null,
    urgencia: r.urgencia,
    estado: r.estado,
    descripcion: r.descripcion,
    direccion: r.direccion_normalizada || r.direccion_raw || null,
    lat: r.lat,
    lng: r.lng,
    comuna: r.comuna_id,
    barrio: null,
    fecha: r.created_at,
    nombre_contacto: r.nombre_contacto,
    dni: null,
    telefono: null, // reclamos_publicos nunca expone el teléfono del reclamante
    email: null,
    creador_nombre: r.creador_nombre ?? null,
    creador_email: r.creador_email ?? null,
    creador_telefono: r.creador_telefono ?? null,
    archivos: [],
    sin_geo: r.lat == null || r.lng == null,
  };
}

export async function getReclamosUnificados(): Promise<ReclamosUnificadosResponse> {
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: nativos, error: nativosError } = await adminClient
    .from("reclamos_publicos")
    .select("*")
    .order("created_at", { ascending: false });

  if (nativosError) throw new Error(nativosError.message);

  // Archivos adjuntos de los reclamos nativos. Se traen en query aparte
  // porque reclamo_archivos tiene FKs de tipos asimétricos (UUID vs INTEGER)
  // y PostGREST no resuelve la relación de forma fiable — ver DOCUMENTACION §7.
  const nativosIds = (nativos ?? []).map((r) => r.id);
  const archivosPorReclamo = new Map<string, ReclamoArchivo[]>();
  if (nativosIds.length > 0) {
    const { data: archivos } = await adminClient
      .from("reclamo_archivos")
      .select("id, reclamo_id, tipo, storage_path, created_at")
      .in("reclamo_id", nativosIds);

    for (const a of archivos ?? []) {
      const list = archivosPorReclamo.get(a.reclamo_id) ?? [];
      list.push({ id: a.id, tipo: a.tipo, storage_path: a.storage_path, created_at: a.created_at });
      archivosPorReclamo.set(a.reclamo_id, list);
    }
  }

  // GeoJSON para derivar comuna/barrio por point-in-polygon. Si falla, se
  // sigue sin geofencing (comuna/barrio quedan null) en vez de romper todo.
  let comunasGeo: any = null;
  let barriosGeo: any = null;
  try {
    [comunasGeo, barriosGeo] = await Promise.all([getComunasGeoJSON(), getBarriosGeoJSON()]);
  } catch (err) {
    console.error("[reclamosUnificados] No se pudo obtener GeoJSON de comunas/barrios:", err);
  }

  const derivarUbicacion = (lat: number | null, lng: number | null) => {
    if (lat == null || lng == null) return { comuna: null as number | null, barrio: null as string | null };
    const point: Point = { lat, lng };
    return {
      comuna: comunasGeo ? getComunaForPoint(point, comunasGeo) : null,
      barrio: barriosGeo ? getBarrioForPoint(point, barriosGeo) : null,
    };
  };

  const reclamosNativos: ReclamoUnificado[] = (nativos ?? []).map((row) => {
    const unificado = mapNativoToUnificado(row as ReclamoPublico);
    const ubicacion = derivarUbicacion(unificado.lat, unificado.lng);
    return {
      ...unificado,
      // Si el geofence no resolvió comuna (sin GeoJSON, o punto fuera de todos
      // los polígonos), se conserva la comuna cargada a mano como respaldo.
      comuna: ubicacion.comuna ?? unificado.comuna,
      barrio: ubicacion.barrio,
      archivos: archivosPorReclamo.get(row.id) ?? [],
    };
  });

  let reclamosMtr: ReclamoUnificado[] = [];
  let mtrError = false;
  try {
    const [claims, fotosPorClaim] = await Promise.all([
      fetchMtrClaims(),
      fetchMtrClaimPhotos(),
    ]);
    reclamosMtr = claims.map((claim) => {
      const unificado = mapClaimToUnificado(claim, fotosPorClaim.get(claim.id) ?? []);
      const ubicacion = derivarUbicacion(unificado.lat, unificado.lng);
      return { ...unificado, comuna: ubicacion.comuna, barrio: ubicacion.barrio };
    });
  } catch (err) {
    console.error("[reclamosUnificados] Error consultando MTR:", err);
    mtrError = true;
  }

  return {
    reclamos: [...reclamosNativos, ...reclamosMtr],
    mtr_error: mtrError,
    total_mapa: reclamosNativos.length,
    total_mtr: reclamosMtr.length,
  };
}
