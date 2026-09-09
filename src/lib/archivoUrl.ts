// Fuente única de las URLs de archivos adjuntos. La usan el popup del mapa y
// el export CSV — no duplicar la lógica, las dos fuentes resuelven distinto:
//
//   · origen "mapa": el bucket propio `reclamos-fotos` es PÚBLICO, así que la
//     URL apunta directo a Supabase Storage.
//   · origen "mtr": su bucket es PRIVADO. La URL apunta al proxy
//     /api/fotos-mtr, que baja el binario server-side con la service_role.
//     Deliberadamente fuera de /api/public/* para que el link del CSV abra sin
//     necesidad de sesión, igual que las fotos nativas (ver docs/DEPLOY-MTR.md).

import type { OrigenReclamo, ReclamoArchivo } from "@/types";
import { api } from "@/lib/rutas";

// Con `basePath`, esta ruta la resuelve el NAVEGADOR (va a un `src` de
// <img> y al CSV), así que Next no la prefija sola. Ver `lib/rutas.ts`.
export const RUTA_PROXY_MTR = api("/api/fotos-mtr");

/** Buckets públicos del proyecto. Los adjuntos de sugerencias viven en otro. */
export const BUCKET_FOTOS = "reclamos-fotos";
export const BUCKET_DOCUMENTOS = "reclamos-documentos";

/**
 * URL relativa al sitio. Suficiente para <img> dentro de la app.
 *
 * `bucket` es opcional y por defecto es el de reclamos, que es el caso de casi
 * todas las llamadas. Las sugerencias suben a `reclamos-documentos`: antes esa
 * URL se armaba a mano en `SugerenciasTable`, que es como se llega a tener dos
 * formas distintas de resolver lo mismo.
 */
export function urlDeArchivo(
  origen: OrigenReclamo,
  archivo: ReclamoArchivo,
  bucket: string = BUCKET_FOTOS
): string {
  if (origen === "mtr") {
    return `${RUTA_PROXY_MTR}/${archivo.storage_path}`;
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  return `${base}/storage/v1/object/public/${bucket}/${archivo.storage_path}`;
}

/**
 * URL absoluta — la que va al CSV, para que el link funcione al abrir el
 * archivo fuera del navegador donde se generó.
 */
export function urlAbsolutaDeArchivo(
  origen: OrigenReclamo,
  archivo: ReclamoArchivo,
  origin: string
): string {
  const url = urlDeArchivo(origen, archivo);
  return url.startsWith("http") ? url : `${origin.replace(/\/$/, "")}${url}`;
}
