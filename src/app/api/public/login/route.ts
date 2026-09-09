import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  PUBLIC_SESSION_COOKIE,
  PUBLIC_SESSION_MAX_AGE_SECONDS,
} from "@/lib/publicSession";
import { getPublicAccounts } from "@/lib/publicAccounts";
import { COOKIE_PATH } from "@/lib/rutas";
import { getClientKey, isRateLimited, registerFailedAttempt, clearAttempts } from "@/lib/rateLimit";

export const runtime = "nodejs";

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: NextRequest) {
  const clientKey = getClientKey(request);

  if (isRateLimited(clientKey)) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Probá de nuevo en unos minutos." },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const user = typeof body?.user === "string" ? body.user : "";
  const password = typeof body?.password === "string" ? body.password : "";

  // Se compara contra TODAS las cuentas (no se corta en el primer match) para
  // que el tiempo de respuesta no varíe según cuál cuenta casi-matchea.
  let matched: string | null = null;
  for (const account of getPublicAccounts()) {
    const ok = timingSafeEqual(user, account.user) && timingSafeEqual(password, account.pass);
    if (ok) matched = account.role;
  }

  if (!matched) {
    registerFailedAttempt(clientKey);
    return NextResponse.json({ error: "Credenciales incorrectas." }, { status: 401 });
  }

  clearAttempts(clientKey);

  const token = await createSessionToken(matched);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PUBLIC_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: PUBLIC_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
