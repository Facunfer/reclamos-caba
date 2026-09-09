import type { NextConfig } from "next";
import path from "path";

/**
 * `basePath` — Reclamos vive adentro del Portal Territorial.
 * ─────────────────────────────────────────────────────────────────────────
 * Esta app se sirve bajo `/reclamos` del dominio del Portal
 * (portal.alianzalalibertadavanzacaba.com), por reverse proxy de nginx contra
 * este mismo proceso. Sigue siendo un proceso Next.js propio y una base de
 * datos propia: lo único que se comparte es el ORIGEN.
 *
 * Y compartir el origen es todo el punto. La PWA del Portal declara
 * `scope: "/"`, así que una navegación a `/reclamos/*` queda adentro de la app
 * instalada. Con un dominio distinto, tocar el botón en un iPhone instalado
 * abre Safari por fuera de la ventana — que es exactamente lo que se quiere
 * evitar.
 *
 * Lo que `basePath` prefija solo: `next/link`, `useRouter().push/replace`,
 * `redirect()` de `next/navigation`, y los assets de `/_next`.
 * Lo que NO prefija, y hay que armar a mano con los helpers de
 * `src/lib/rutas.ts`: los `fetch("/api/...")`, los `<a href>` crudos y
 * cualquier `window.location`. Ver el comentario de ese archivo.
 *
 * El matcher del middleware se evalúa SIN el prefijo (Next lo saca antes),
 * así que `src/middleware.ts` no cambia sus rutas — pero sus redirects sí,
 * porque `new URL("/login", request.url)` se lleva puesto el prefijo.
 */
// Fuente única del prefijo. No se exporta a propósito: importar `next.config`
// desde código de la app arrastraría la config entera al bundle. Quien lo
// necesite lo lee de `src/lib/rutas.ts`, que lo toma del env de abajo.
const BASE_PATH = "/reclamos";

const nextConfig: NextConfig = {
  basePath: BASE_PATH,

  // Se expone al bundle del cliente para que `src/lib/rutas.ts` arme los
  // `fetch` y los `href` crudos con el mismo prefijo, sin hardcodearlo en dos
  // lugares. No es un secreto: ya viaja en cada URL de la barra de direcciones.
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },

  // Leaflet needs this to avoid SSR issues
  transpilePackages: ["leaflet", "react-leaflet"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
