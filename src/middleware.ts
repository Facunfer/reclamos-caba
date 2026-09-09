// src/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, PUBLIC_SESSION_COOKIE } from "@/lib/publicSession";
import { puedeVer, type PublicTab } from "@/lib/publicAccounts";
import { COOKIE_PATH } from "@/lib/rutas";

// Qué pestaña de /public corresponde a cada página, para chequear el rol.
// "reclamos" (la home de /public) no está listada porque todos los roles
// la tienen — no hace falta restringirla.
const TAB_POR_RUTA: { prefix: string; tab: PublicTab }[] = [
  { prefix: "/public/sugerencias", tab: "sugerencias" },
  { prefix: "/public/circuitos", tab: "circuitos" },
  { prefix: "/public/comunas", tab: "usuarios" },
];

/**
 * Redirect interno que respeta el `basePath`.
 *
 * `new URL("/login", request.url)` NO sirve con `basePath`: `request.url` de un
 * pedido a `/reclamos/panel` es `https://host/reclamos/panel`, y resolver
 * "/login" contra eso da `https://host/login` — la raíz del PORTAL, otra app.
 * El usuario termina en el login del CRM sin que nada falle ruidosamente.
 *
 * `request.nextUrl` es un `NextURL`, que sí conoce el prefijo: se le asigna el
 * pathname pelado y al serializar lo vuelve a poner.
 */
function redirigir(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

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
      return redirigir(request, "/public/login");
    }

    if (isPublicPage) {
      const restringida = TAB_POR_RUTA.find((r) => pathname.startsWith(r.prefix));
      if (restringida && !puedeVer(role, restringida.tab)) {
        return redirigir(request, "/public");
      }
    }
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Mismo `path` que los otros dos clientes (browser y server). Si el
      // middleware refrescara el token en "/" mientras el resto escribe en
      // "/reclamos", quedarían dos cookies homónimas y la sesión se caería de
      // forma intermitente. Ver `COOKIE_PATH`.
      cookieOptions: { path: COOKIE_PATH },
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
    return redirigir(request, "/login");
  }

  // Redirect logged-in users away from /login
  if (request.nextUrl.pathname === "/login" && user) {
    return redirigir(request, "/panel");
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/panel/:path*", "/login", "/public/:path*", "/api/public/:path*"],
};
