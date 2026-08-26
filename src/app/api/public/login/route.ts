import { NextRequest, NextResponse } from "next/server";
import {
  createSessionToken,
  PUBLIC_SESSION_COOKIE,
  PUBLIC_SESSION_MAX_AGE_SECONDS,
} from "@/lib/publicSession";
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

  const masterUser = process.env.MASTER_USER;
  const masterPass = process.env.MASTER_PASS;

  const credentialsConfigured = Boolean(masterUser && masterPass);
  const ok =
    credentialsConfigured &&
    timingSafeEqual(user, masterUser!) &&
    timingSafeEqual(password, masterPass!);

  if (!ok) {
    registerFailedAttempt(clientKey);
    return NextResponse.json({ error: "Credenciales incorrectas." }, { status: 401 });
  }

  clearAttempts(clientKey);

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PUBLIC_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PUBLIC_SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
