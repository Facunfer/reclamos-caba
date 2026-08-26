import { NextRequest, NextResponse } from "next/server";
import { MTR_BUCKET_FOTOS } from "@/lib/mtr";

export const runtime = "nodejs";

// Ruta ABIERTA a propósito (fuera de /api/public/*, que el middleware protege):
// los links de fotos del CSV tienen que abrir sin sesión, igual que las fotos
// de los reclamos nativos, cuyo bucket ya es público. Decisión explícita —
// ver docs/DEPLOY-MTR.md.
//
// El bucket de MTR es privado, así que el binario se baja acá server-side con
// la service_role y se devuelve al cliente. La service_role NUNCA sale de este
// proceso.

// Los storage_path de MTR son siempre "{uuid-del-claim}/{archivo}".
// Validar contra este patrón es lo que impide que la ruta se use como proxy
// arbitrario: sin esto, un `..%2F..%2F` o un path a otro bucket saldría
// firmado con la service_role.
const PATH_VALIDO =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/[A-Za-z0-9._-]+$/;

const EXT_PERMITIDAS = /\.(jpg|jpeg|png|webp|gif|pdf)$/i;

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const storagePath = (path ?? []).join("/");

  if (!PATH_VALIDO.test(storagePath) || !EXT_PERMITIDAS.test(storagePath)) {
    return NextResponse.json({ error: "Ruta inválida" }, { status: 400 });
  }

  const url = process.env.MTR_SUPABASE_URL;
  const key = process.env.MTR_SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("[api/fotos-mtr] MTR_SUPABASE_URL / MTR_SUPABASE_SERVICE_KEY sin configurar");
    return NextResponse.json({ error: "Integración MTR no configurada" }, { status: 503 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(
      `${url}/storage/v1/object/${MTR_BUCKET_FOTOS}/${storagePath}`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
  } catch (err) {
    console.error("[api/fotos-mtr] Error consultando el storage de MTR:", err);
    return NextResponse.json({ error: "No se pudo obtener el archivo" }, { status: 502 });
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: "Archivo no encontrado" },
      { status: upstream.status === 404 || upstream.status === 400 ? 404 : 502 }
    );
  }

  const ext = storagePath.split(".").pop()!.toLowerCase();
  const contentType =
    upstream.headers.get("content-type") ?? CONTENT_TYPES[ext] ?? "application/octet-stream";

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Inmutable: el path incluye el uuid del claim y el archivo no se
      // sobrescribe, así que se puede cachear agresivamente.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": "inline",
    },
  });
}
