import { NextResponse } from "next/server";
import { PUBLIC_SESSION_COOKIE } from "@/lib/publicSession";
import { COOKIE_PATH } from "@/lib/rutas";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // El `path` tiene que ser EL MISMO con el que se creó: un borrado en "/"
  // no toca una cookie guardada en "/reclamos", y la sesión sobrevive al
  // logout sin ningún error visible.
  res.cookies.set(PUBLIC_SESSION_COOKIE, "", { path: COOKIE_PATH, maxAge: 0 });
  return res;
}
