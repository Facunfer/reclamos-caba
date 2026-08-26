// Cliente server-only para "Mandame Tu Reclamo" (MTR), un proyecto Supabase
// externo. Usa la service_role key de MTR vía REST directo (PostgREST) —
// NO hay MCP/SDK conectado a ese proyecto, así que se habla HTTP crudo.
//
// IMPORTANTE: este módulo lee MTR_SUPABASE_SERVICE_KEY. Nunca debe
// importarse desde un componente cliente ("use client") ni desde código
// que corra en el navegador.

import { mapMtrGrupoToTipo } from "@/lib/taxonomia";
import type { ReclamoArchivo, ReclamoUnificado } from "@/types";

export interface MtrClaim {
  id: string;
  tracking_code: string;
  nombre_apellido: string | null;
  dni: string | null;
  telefono: string | null;
  email: string | null;
  direccion_ingresada: string | null;
  direccion_normalizada: string | null;
  lat: number | null;
  lng: number | null;
  grupo: string;
  subtipo: string | null;
  observaciones: string | null;
  status: string;
  created_at: string;
}

const CLAIMS_COLUMNS =
  "id,tracking_code,nombre_apellido,dni,telefono,email,direccion_ingresada,direccion_normalizada,lat,lng,grupo,subtipo,observaciones,status,created_at";

const PAGE_SIZE = 1000;
const MAX_PAGES = 20; // salvaguarda: hasta 20.000 filas antes de cortar

function getMtrConfig() {
  const url = process.env.MTR_SUPABASE_URL;
  const key = process.env.MTR_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("MTR_SUPABASE_URL / MTR_SUPABASE_SERVICE_KEY no están configuradas");
  }
  return { url, key };
}

export async function fetchMtrClaims(): Promise<MtrClaim[]> {
  const { url, key } = getMtrConfig();
  const all: MtrClaim[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const res = await fetch(
      `${url}/rest/v1/claims?select=${CLAIMS_COLUMNS}&order=created_at.desc`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Range: `${from}-${to}`,
        },
        next: { revalidate: 60 },
      }
    );

    if (!res.ok) {
      throw new Error(`MTR respondió ${res.status} ${res.statusText}`);
    }

    const batch: MtrClaim[] = await res.json();
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  return all;
}

export const MTR_BUCKET_FOTOS = "reclamos-fotos";

/**
 * Fotos adjuntas de MTR, agrupadas por claim_id.
 * El bucket de MTR es PRIVADO: `storage_path` no se puede servir directo al
 * navegador. Las URLs las arma `urlDeArchivo()` apuntando al proxy
 * /api/fotos-mtr, que baja el binario server-side con la service_role.
 */
export async function fetchMtrClaimPhotos(): Promise<Map<string, ReclamoArchivo[]>> {
  const { url, key } = getMtrConfig();
  const porClaim = new Map<string, ReclamoArchivo[]>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const res = await fetch(
      `${url}/rest/v1/claim_photos?select=id,claim_id,storage_path,position,created_at&order=position.asc`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${to}` },
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) throw new Error(`MTR (claim_photos) respondió ${res.status} ${res.statusText}`);

    const batch: { id: string; claim_id: string; storage_path: string; created_at: string }[] =
      await res.json();

    for (const f of batch) {
      const lista = porClaim.get(f.claim_id) ?? [];
      lista.push({
        id: f.id,
        tipo: /\.(pdf)$/i.test(f.storage_path) ? "pdf" : "foto",
        storage_path: f.storage_path,
        created_at: f.created_at,
      });
      porClaim.set(f.claim_id, lista);
    }

    if (batch.length < PAGE_SIZE) break;
  }

  return porClaim;
}

export function mapClaimToUnificado(
  claim: MtrClaim,
  archivos: ReclamoArchivo[] = []
): ReclamoUnificado {
  const lat = claim.lat ?? null;
  const lng = claim.lng ?? null;
  return {
    id: `mtr:${claim.id}`,
    origen: "mtr",
    tipo: mapMtrGrupoToTipo(claim.grupo),
    subtipo: claim.subtipo ?? null,
    urgencia: null, // MTR no tiene urgencia
    estado: claim.status ?? null,
    descripcion: claim.observaciones ?? null,
    direccion: claim.direccion_normalizada || claim.direccion_ingresada || null,
    lat,
    lng,
    comuna: null, // se completa server-side con point-in-polygon
    barrio: null,
    fecha: claim.created_at,
    nombre_contacto: claim.nombre_apellido ?? null,
    dni: claim.dni ?? null,
    telefono: claim.telefono ?? null,
    email: claim.email ?? null,
    // MTR no pasa por el circuito de carga comunal, no hay "creador".
    creador_nombre: null,
    creador_email: null,
    creador_telefono: null,
    archivos,
    sin_geo: lat == null || lng == null,
  };
}
