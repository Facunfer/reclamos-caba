// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, PUBLIC_SESSION_COOKIE } from "@/lib/publicSession";
import { puedeVer, type PublicTab } from "@/lib/publicAccounts";

// Qué pestaña de /public corresponde a cada página, para chequear el rol.
// "reclamos" (la home de /public) no está listada porque todos los roles
// la tienen — no hace falta restringirla.
const TAB_POR_RUTA: { prefix: string; tab: PublicTab }[] = [
  { prefix: "/public/sugerencias", tab: "sugerencias" },
  { prefix: "/public/circuitos", tab: "circuitos" },
  { prefix: "/public/comunas", tab: "usuarios" },
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Gate del dashboard público (/public) y de su API server-side (/api/public).
  // La validación de la contraseña es 100% server-side (route handler); acá
  // solo se verifica que exista una cookie de sesión firmada y vigente, y que
  // el rol que lleva adentro tenga permiso para la pestaña pedida.
  const isPublicLoginRoute = pathname === "/public/login" || pathname === "/api/public/login";
  const isPublicPage = pathname.startsWith("/public") && !isPublicLoginRoute;
  const isPublicApi = pathname.startsWith("/api/public") && !isPublicLoginRoute;

  if (isPublicPage || isPublicApi) {
    const token = request.cookies.get(PUBLIC_SESSION_COOKIE)?.value;
    const role = await verifySessionToken(token);
    if (!role) {
      if (isPublicApi) {
        return NextResponse.json({ error: "No autorizado" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/public/login", request.url));
    }

    if (isPublicPage) {
      const restringida = TAB_POR_RUTA.find((r) => pathname.startsWith(r.prefix));
      if (restringida && !puedeVer(role, restringida.tab)) {
        return NextResponse.redirect(new URL("/public", request.url));
      }
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /panel routes
  if (request.nextUrl.pathname.startsWith("/panel") && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect logged-in users away from /login
  if (request.nextUrl.pathname === "/login" && user) {
    return NextResponse.redirect(new URL("/panel", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/panel/:path*", "/login", "/public/:path*", "/api/public/:path*"],
};
