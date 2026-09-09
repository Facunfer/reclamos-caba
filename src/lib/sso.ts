/**
 * Puente de sesión desde el Portal Territorial — lado que VERIFICA.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * El contrato
 * ─────────────────────────────────────────────────────────────────────────
 * El Portal (repo `portal-crm`, `lib/sso-reclamos.ts`) firma con HMAC-SHA256 un
 * pase que dice "quien trae esto es el usuario N del Portal, de la comuna M".
 * Acá se verifica esa firma y se consume el pase.
 *
 * Los dos archivos están DUPLICADOS a propósito: son dos repos y dos procesos,
 * y montar un paquete compartido para 80 líneas costaría más de lo que
 * ahorraría. El precio es que hay que tocarlos juntos, y por eso el payload
 * lleva `v`: si las versiones se desfasan, esto rechaza el token con un motivo
 * explícito en vez de interpretar mal los campos.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Qué NO hace este módulo
 * ─────────────────────────────────────────────────────────────────────────
 * No decide nada sobre permisos. Verificar la firma prueba que el pase lo emitió
 * el Portal, no que quien lo trae deba entrar: la comuna que viaja adentro es
 * la que el Portal afirma, y este sistema la acepta porque el Portal es la
 * fuente de verdad de quién es de qué comuna. Todo lo demás —qué reclamos ve—
 * lo sigue decidiendo la RLS de Postgres contra `perfiles`, igual que para un
 * usuario que entró con contraseña.
 */

export const SSO_VERSION = 1;

/** Igual que del otro lado. Ver el comentario de `lib/sso-reclamos.ts`. */
export const SSO_TTL_SEGUNDOS = 60;

export interface PayloadSSO {
  v: number;
  uid: number;
  usuario: string;
  comuna: number;
  jti: string;
  iat: number;
  exp: number;
}

/** Motivo del rechazo. Se loguea; NUNCA se le muestra al usuario en detalle. */
export type MotivoRechazo =
  | "sin_token"
  | "formato"
  | "firma"
  | "version"
  | "vencido"
  | "reusado"
  | "payload";

/**
 * Resultado del canje.
 *
 * Es un objeto con tres campos y no una unión discriminada (`{ok:true,...} |
 * {ok:false,...}`), que sería lo natural, porque este proyecto compila con
 * `strict: false` en `tsconfig.json`. Sin `strictNullChecks`, TypeScript NO
 * estrecha uniones por un campo booleano: adentro de un `if (!r.ok)` seguiría
 * sin ver `r.motivo`, y el compilador rechaza el código correcto.
 *
 * Prenderle `strict` al proyecto entero es una decisión aparte y más grande que
 * este cambio. Mientras tanto, esta forma es honesta sobre lo que el compilador
 * puede garantizar acá: quien la consume tiene que chequear `payload` además de
 * `ok`.
 */
export interface ResultadoSSO {
  ok: boolean;
  payload: PayloadSSO | null;
  motivo: MotivoRechazo | null;
}

function rechazo(motivo: MotivoRechazo): ResultadoSSO {
  return { ok: false, payload: null, motivo };
}

function b64urlDecode(s: string): Uint8Array {
  const base = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base + "=".repeat((4 - (base.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function secreto(): string {
  const s = process.env.SSO_BRIDGE_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SSO_BRIDGE_SECRET no está definida o es demasiado corta (mínimo 32 caracteres)."
    );
  }
  return s;
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

/**
 * Comparación en tiempo constante. Con un `===` común, el tiempo de respuesta
 * varía según cuántos caracteres coinciden, y con suficientes intentos eso
 * permite ir adivinando la firma byte a byte. Es el mismo helper que ya usa el
 * login del dashboard público.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Pases ya canjeados.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Por qué alcanza con memoria
 * ─────────────────────────────────────────────────────────────────────────
 * Es el mismo criterio que `lib/rateLimit.ts`: PM2 corre esta app en modo fork,
 * o sea **un** proceso, así que "en memoria" y "global" son lo mismo. Un
 * reinicio vacía el set, y el peor caso de eso es que un pase de menos de 60
 * segundos que ya se usó vuelva a servir — para lo cual hay que reiniciar el
 * servidor dentro de esa ventana y además tener el token.
 *
 * Si algún día se pasa a cluster mode, esto deja de garantizar el uso único y
 * hay que moverlo a una tabla. El TTL corto lo hace un riesgo acotado, no
 * inexistente.
 */
const canjeados = new Map<string, number>();

function limpiarVencidos(ahora: number) {
  // El barrido es O(n) pero n es "los canjes del último minuto": con 66
  // usuarios posibles, son unidades.
  for (const [jti, exp] of canjeados) {
    if (exp <= ahora) canjeados.delete(jti);
  }
}

/**
 * Verifica y CONSUME el pase. Llamarla dos veces con el mismo token devuelve
 * `reusado` la segunda vez — el consumo es parte de la verificación a
 * propósito, para que no exista un camino donde alguien valide sin consumir.
 */
export async function verificarYConsumir(token: string | null | undefined): Promise<ResultadoSSO> {
  if (!token) return rechazo("sin_token");

  const punto = token.lastIndexOf(".");
  if (punto <= 0) return rechazo("formato");

  const cuerpo = token.slice(0, punto);
  const firma = token.slice(punto + 1);

  // La firma se verifica ANTES de mirar el contenido. Al revés se estaría
  // parseando JSON que todavía no se sabe si lo escribió el Portal.
  const esperada = await hmac(cuerpo);
  if (!timingSafeEqual(esperada, firma)) return rechazo("firma");

  let payload: PayloadSSO;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(cuerpo)));
  } catch {
    return rechazo("formato");
  }

  if (payload?.v !== SSO_VERSION) return rechazo("version");

  if (
    !Number.isInteger(payload.uid) ||
    typeof payload.usuario !== "string" ||
    !payload.usuario ||
    !Number.isInteger(payload.comuna) ||
    payload.comuna < 1 ||
    payload.comuna > 15 ||
    typeof payload.jti !== "string" ||
    !payload.jti ||
    !Number.isFinite(payload.exp)
  ) {
    return rechazo("payload");
  }

  const ahora = Math.floor(Date.now() / 1000);
  if (payload.exp <= ahora) return rechazo("vencido");

  // Un `exp` demasiado lejano significa que el emisor cambió el TTL sin avisar,
  // o que alguien con el secreto se está fabricando un pase de larga vida. Se
  // rechaza igual que uno vencido: el contrato es "60 segundos".
  if (payload.exp - ahora > SSO_TTL_SEGUNDOS + 5) return rechazo("vencido");

  limpiarVencidos(ahora);
  if (canjeados.has(payload.jti)) return rechazo("reusado");
  canjeados.set(payload.jti, payload.exp);

  return { ok: true, payload, motivo: null };
}

/**
 * Email de la cuenta de Reclamos que corresponde a un usuario del Portal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Por qué el id y no el username
 * ─────────────────────────────────────────────────────────────────────────
 * El username del Portal se puede cambiar; el `usuarios.id` no. Si la cuenta se
 * anclara al username, renombrar a alguien le crearía una cuenta NUEVA en
 * Reclamos y perdería el rastro de todo lo que cargó — que es justamente lo que
 * este esquema viene a resolver.
 *
 * El subdominio `portal.` en el email deja a la vista, en la lista de usuarios
 * y en la tabla de Auth, cuáles son cuentas del puente y cuáles son las 15
 * cuentas comunales históricas. Es un dominio que no existe y no recibe correo:
 * estas cuentas nunca mandan mail (se crean con `email_confirm: true` y no
 * tienen flujo de recuperación), así que no hace falta que sea real.
 */
export function emailDeUsuarioPortal(uid: number): string {
  return `u${uid}@portal.reclamos.gob.ar`;
}
