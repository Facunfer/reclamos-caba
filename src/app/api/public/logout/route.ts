import { NextResponse } from "next/server";
import { PUBLIC_SESSION_COOKIE } from "@/lib/publicSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PUBLIC_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
