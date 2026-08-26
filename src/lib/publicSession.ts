// Sesión firmada para el gate del dashboard público (/public).
// Usa Web Crypto (crypto.subtle) en vez de Buffer/node:crypto para que
// funcione igual en el middleware (edge runtime) y en los route handlers.

import { cookies } from "next/headers";

export const PUBLIC_SESSION_COOKIE = "public_session";
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12hs
export const PUBLIC_SESSION_MAX_AGE_SECONDS = SESSION_DURATION_MS / 1000;

// "master" ve todas las pestañas. Cualquier otro valor es un rol restringido
// — ver PUBLIC_TABS_POR_ROL más abajo para qué pestañas tiene cada uno.
export type PublicRole = "master" | (string & {});

function getSecret(): string {
  const secret = process.env.PUBLIC_SESSION_SECRET;
  if (!secret) {
    throw new Error("PUBLIC_SESSION_SECRET no está definida en el entorno.");
  }
  return secret;
}

function toBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return toBase64Url(sig);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// El rol viaja adentro del payload firmado (no es un campo aparte sin
// firmar), así que no se puede escalar de "reclamos" a "master" editando la
// cookie a mano: cualquier cambio invalida la firma HMAC.
function encodePayload(expiresAt: number, role: string): string {
  return `${expiresAt}:${role}`;
}
function decodePayload(payload: string): { expiresAt: number; role: string } | null {
  const idx = payload.indexOf(":");
  if (idx === -1) return null;
  const expiresAt = Number(payload.slice(0, idx));
  const role = payload.slice(idx + 1);
  if (!Number.isFinite(expiresAt) || !role) return null;
  return { expiresAt, role };
}

export async function createSessionToken(role: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  const payload = encodePayload(expiresAt, role);
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

/** Devuelve el rol si el token es válido y no expiró; null en cualquier otro caso. */
export async function verifySessionToken(token: string | undefined | null): Promise<string | null> {
  if (!token) return null;
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);

  const expectedSig = await hmac(payload);
  if (!timingSafeEqual(expectedSig, sig)) return null;

  const decoded = decodePayload(payload);
  if (!decoded) return null;
  if (Date.now() > decoded.expiresAt) return null;

  return decoded.role;
}

/**
 * Para Server Components de /public: lee y valida la cookie de sesión. El
 * middleware ya garantiza que exista y sea válida para llegar hasta acá, así
 * que null solo pasaría en un estado inconsistente — en ese caso se devuelve
 * el rol más restringido en vez de asumir "master".
 */
export async function getPublicRole(): Promise<PublicRole> {
  const store = await cookies();
  const token = store.get(PUBLIC_SESSION_COOKIE)?.value;
  const role = await verifySessionToken(token);
  return role ?? "reclamos";
}
