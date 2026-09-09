/**
 * Rutas absolutas internas, con el prefijo de `basePath`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Por qué hace falta este archivo
 * ─────────────────────────────────────────────────────────────────────────
 * Con `basePath: "/reclamos"` en `next.config.ts`, Next prefija solo:
 *
 *   - `href` de `next/link`
 *   - `useRouter().push()` / `.replace()`
 *   - `redirect()` de `next/navigation`
 *   - los assets de `/_next/*`
 *
 * NO prefija nada que sea un string armado a mano y entregado al navegador:
 *
 *   - `fetch("/api/geocode")`      → pega en `/api/geocode` del PORTAL, no acá
 *   - `<a href="/panel">`          → saca al usuario a la raíz del Portal
 *   - `window.location.href = ...` → ídem
 *
 * Y ninguno de esos tres falla de forma ruidosa. El `fetch` recibe el HTML del
 * login del Portal y devuelve un error de parseo que no menciona la URL; el
 * `<a>` "funciona" y deposita al usuario en otra aplicación. Por eso el prefijo
 * vive acá y no repetido en cada archivo: agregar un `fetch` nuevo sin pensar
 * en esto es demasiado fácil.
 *
 * Regla práctica: si el string se lo entregás a Next (`Link`, `router`,
 * `redirect`), va pelado. Si se lo entregás al navegador, pasa por acá.
 */

/**
 * `next.config.ts` lo inyecta vía `env`. El `?? ""` no es defensivo de más:
 * los tests y los scripts de `scripts/` corren fuera del build de Next, sin
 * esa variable, y tienen que poder importar este módulo sin explotar.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Prefija una ruta interna. `ruta` siempre arranca con "/".
 *
 * Idempotente a propósito: si alguien pasa una ruta que ya trae el prefijo, la
 * devuelve igual en vez de generar `/reclamos/reclamos/panel`. Es el error más
 * probable al migrar un archivo que ya se tocó una vez.
 */
export function ruta(r: string): string {
  if (!BASE_PATH) return r;
  if (r === BASE_PATH || r.startsWith(`${BASE_PATH}/`)) return r;
  return `${BASE_PATH}${r}`;
}

/**
 * Igual que `ruta()`, pero para endpoints de la API. Existe como función
 * aparte solo para que el `grep` de "¿qué fetch hay en esta app?" siga
 * encontrando un único identificador y no haya que leer cada llamada.
 */
export function api(r: string): string {
  return ruta(r);
}

/**
 * `Path` de TODAS las cookies de esta app: la sesión de Supabase Auth del panel
 * y la `public_session` firmada del dashboard.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Por qué no alcanza con dejarlas en "/"
 * ─────────────────────────────────────────────────────────────────────────
 * Reclamos y el Portal comparten origen. Una cookie en `Path=/` la manda el
 * navegador en **todos** los requests del Portal, incluida cada navegación del
 * CRM: son ~3 kB de token de Supabase viajando en pedidos que no los usan.
 *
 * Y lo más importante: si algún día las dos apps eligen el mismo NOMBRE de
 * cookie, la de una pisa la sesión de la otra sin que nadie se entere — el
 * navegador no distingue orígenes acá, solo paths. Hoy no chocan (`crm_sid` vs
 * `sb-*` / `public_session`), pero "hoy no chocan" no es una garantía que
 * sobreviva a la próxima librería de auth que alguien instale.
 *
 * `Path=/reclamos` cubre `/reclamos` y todo lo que cuelgue debajo, que es
 * exactamente el alcance de esta app.
 */
export const COOKIE_PATH = BASE_PATH || "/";

/**
 * Dónde vuelve el botón "← Portal" del panel.
 *
 * Es una URL absoluta y configurable, no `/`, porque esta app se sirve desde
 * DOS dominios: `portal.alianzalalibertadavanzacaba.com/reclamos` (adentro de
 * la PWA) y su dominio propio `mapa.alianzalalibertadavanzacaba.com/reclamos`.
 * Con `/`, desde el dominio propio el link caería en el redirect de nginx que
 * devuelve a `/reclamos/` — o sea, un botón "volver" que no vuelve a ningún
 * lado.
 *
 * Absoluta también es segura para la PWA: cuando el usuario ya está en el
 * origen del Portal, es same-origin y la navegación queda adentro de la app
 * instalada.
 */
export const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "/";
