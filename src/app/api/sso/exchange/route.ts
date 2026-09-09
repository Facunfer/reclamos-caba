import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { COOKIE_PATH, ruta } from "@/lib/rutas";
import { emailDeUsuarioPortal, verificarYConsumir, type PayloadSSO } from "@/lib/sso";

/**
 * Canje del pase del Portal por una sesión real de Reclamos.
 *
 * Vive en `/reclamos/api/sso/exchange` (el `basePath` lo agrega Next). El
 * usuario llega acá por un redirect del Portal, con un token de 60 segundos y
 * un solo uso en la query.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Lo que hace, en orden
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Verifica y CONSUME el pase (`lib/sso.ts`).
 *   2. Resuelve —o crea— la cuenta de Auth de esa persona, y su `perfil` en la
 *      comuna que afirma el Portal.
 *   3. Emite una sesión de Supabase igual que un login con contraseña, y la
 *      escribe en las cookies de `@supabase/ssr`.
 *   4. Deja registro del canje.
 *   5. Redirige a `/reclamos/panel`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Cuentas individuales, y por qué
 * ─────────────────────────────────────────────────────────────────────────
 * Se decidió NO reusar las cuentas comunales compartidas (`cN@reclamos.gob.ar`).
 * Cada usuario del Portal tiene la suya, derivada de su `usuarios.id`.
 *
 * El motivo es trazabilidad: `reclamos.creado_por_user_id` existe desde el
 * principio, pero con una cuenta por comuna apunta siempre al mismo usuario, así
 * que hoy no se puede saber quién cargó ninguno de los 177 reclamos. Con cuenta
 * individual, cada reclamo nuevo queda atribuido a una persona. Además, dar de
 * baja a alguien pasa a ser posible sin cambiarle la contraseña a una comuna
 * entera.
 *
 * Las 15 cuentas comunales siguen existiendo y funcionando por `/reclamos/login`:
 * esto agrega un camino, no reemplaza el que había.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Qué pasa si algo falla
 * ─────────────────────────────────────────────────────────────────────────
 * Cierra: se redirige al login normal con un motivo genérico en la URL. Al
 * usuario no se le dice si el token estaba vencido, reusado o mal firmado —
 * distinguirlo solo le sirve a quien esté probando tokens. El motivo real va al
 * log del servidor.
 *
 * La única excepción es el registro de auditoría (paso 4): si ESE falla, la
 * sesión se abre igual y el error queda en el log. Bloquear el acceso de las 15
 * comunas porque no se pudo escribir una fila de auditoría sería peor que la
 * falta del registro.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A dónde se manda a alguien cuyo canje no prosperó. */
function alLogin(motivo: "expirado" | "invalido") {
  return new Response(null, {
    status: 303,
    headers: {
      Location: ruta(`/login?sso=${motivo}`),
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  const verificado = await verificarYConsumir(token);
  if (!verificado.ok || !verificado.payload) {
    // El motivo va al log del servidor, no a la pantalla.
    console.warn(`[sso] canje rechazado: ${verificado.motivo}`);
    return alLogin(verificado.motivo === "vencido" ? "expirado" : "invalido");
  }

  const payload = verificado.payload;
  const sb = admin();

  let userId: string;
  try {
    userId = await resolverCuenta(sb, payload);
  } catch (e) {
    console.error("[sso] no se pudo resolver la cuenta:", e);
    return alLogin("invalido");
  }

  // ── Emitir la sesión ────────────────────────────────────────────────────
  // `generateLink` produce el mismo `hashed_token` que un magic link por mail,
  // sin mandar ningún mail. Canjearlo con `verifyOtp` deja exactamente la misma
  // sesión que un login con contraseña: mismos tokens, misma expiración, mismo
  // refresh. No hay una sesión "de segunda" para los que entran por acá.
  const { data: link, error: errLink } = await sb.auth.admin.generateLink({
    type: "magiclink",
    email: emailDeUsuarioPortal(payload.uid),
  });

  if (errLink || !link?.properties?.hashed_token) {
    console.error("[sso] generateLink falló:", errLink);
    return alLogin("invalido");
  }

  // Las cookies se juntan en un array y se aplican a la respuesta a mano en vez
  // de usar `cookies()` de Next. Es más verboso, pero acá la respuesta es un
  // redirect construido a mano y no un render: así queda a la vista que las
  // cookies salen SÍ o SÍ en la misma respuesta que el `Location`, que es lo
  // único que hace que el `/panel` de destino encuentre la sesión.
  const aEscribir: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { path: COOKIE_PATH },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => aEscribir.push(...cookies),
      },
    }
  );

  const { error: errOtp } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "email",
  });

  if (errOtp) {
    console.error("[sso] verifyOtp falló:", errOtp);
    return alLogin("invalido");
  }

  await registrarCanje(sb, payload, userId);

  const res = NextResponse.redirect(new URL(ruta("/panel"), request.nextUrl), {
    status: 303,
  });
  res.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  for (const c of aEscribir) res.cookies.set(c.name, c.value, c.options);
  return res;
}

/**
 * Devuelve el `auth.users.id` de esta persona, creando lo que falte.
 *
 * Es idempotente porque tiene que serlo: se ejecuta en CADA click del botón,
 * no una sola vez al dar de alta a alguien.
 */
async function resolverCuenta(
  sb: ReturnType<typeof admin>,
  payload: PayloadSSO
): Promise<string> {
  const email = emailDeUsuarioPortal(payload.uid);

  // `createUser` sobre un email que ya existe devuelve error en vez de la fila,
  // así que primero se busca. `listUsers` no filtra por email en esta versión
  // del SDK; el `perfiles` propio sí es consultable por email y es lo que se usa
  // como índice, con `listUsers` como respaldo para el caso de una cuenta de
  // Auth que quedó sin perfil (un rollback a medias, por ejemplo).
  const { data: perfilExistente } = await sb
    .from("perfiles")
    .select("user_id, comuna_id")
    .eq("email", email)
    .maybeSingle();

  if (perfilExistente?.user_id) {
    // El Portal es la fuente de verdad de a qué comuna pertenece cada persona.
    // Si allá la cambiaron, acá se sigue: si no, seguiría viendo los reclamos de
    // su comuna anterior, que es exactamente lo que la RLS existe para impedir.
    if (perfilExistente.comuna_id !== payload.comuna) {
      const { error } = await sb
        .from("perfiles")
        .update({ comuna_id: payload.comuna })
        .eq("user_id", perfilExistente.user_id);
      if (error) throw new Error(`no se pudo actualizar la comuna: ${error.message}`);
      console.warn(
        `[sso] uid=${payload.uid} cambió de comuna ${perfilExistente.comuna_id} → ${payload.comuna}`
      );
    }
    return perfilExistente.user_id;
  }

  // Sin perfil: puede que la cuenta de Auth exista igual (alta interrumpida).
  const existente = await buscarAuthUserPorEmail(sb, email);
  const userId = existente ?? (await crearAuthUser(sb, email, payload));

  const { error: errPerfil } = await sb.from("perfiles").insert({
    user_id: userId,
    comuna_id: payload.comuna,
    role: "comuna",
    // Las cuentas del puente NO pueden crear sub-usuarios: sus altas se
    // gestionan del lado del Portal, que es donde vive el modelo de permisos.
    // Dos lugares para dar de alta gente sería dos lugares donde revisar quién
    // tiene acceso.
    can_create_users: false,
    is_master: false,
    nombre: payload.usuario,
    email,
  });

  if (errPerfil) {
    // Mismo patrón transaccional manual que `/api/usuarios/crear`: si el perfil
    // no se pudo crear, la cuenta de Auth suelta no sirve para nada y encima
    // haría que el próximo intento tome el camino de "existe pero sin perfil".
    // Solo se borra si la creamos nosotros en esta misma request.
    if (!existente) await sb.auth.admin.deleteUser(userId);
    throw new Error(`no se pudo crear el perfil: ${errPerfil.message}`);
  }

  return userId;
}

async function buscarAuthUserPorEmail(
  sb: ReturnType<typeof admin>,
  email: string
): Promise<string | null> {
  // Paginado defensivo: hoy son decenas de usuarios, pero `listUsers` devuelve
  // 50 por página y quedarse con la primera sería un bug latente que aparece
  // recién cuando el sistema creció.
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers falló: ${error.message}`);
    // El tipo que devuelve el SDK es una unión que, sin `strictNullChecks`,
    // colapsa a `never` al recorrerla. El shape real es siempre este.
    const users = ((data?.users ?? []) as { id: string; email?: string }[]);
    const hit = users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (users.length < 200) return null;
  }
  return null;
}

async function crearAuthUser(
  sb: ReturnType<typeof admin>,
  email: string,
  payload: PayloadSSO
): Promise<string> {
  // La contraseña es aleatoria y NADIE la conoce, ni siquiera se guarda: a esta
  // cuenta se entra únicamente por el puente. Supabase exige una, así que se
  // genera una que no se puede adivinar en vez de dejar un valor por defecto
  // que después sería la próxima `123456`.
  const password = crypto.randomUUID() + crypto.randomUUID();

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      nombre: payload.usuario,
      origen: "portal-sso",
      portal_uid: payload.uid,
    },
  });

  if (error || !data.user) throw new Error(`createUser falló: ${error?.message}`);
  return data.user.id;
}

/**
 * Registro del canje.
 *
 * Hasta ahora este sistema no tenía NINGÚN registro de accesos: ni del panel
 * comunal (contraseña compartida por comuna) ni del dashboard público (una sola
 * contraseña para todos). Agregar un camino de entrada más sin dejar rastro
 * habría empeorado eso.
 *
 * Falla en silencio a propósito — ver el encabezado del archivo.
 */
async function registrarCanje(
  sb: ReturnType<typeof admin>,
  payload: PayloadSSO,
  userId: string
) {
  const { error } = await sb.from("sso_accesos").insert({
    portal_uid: payload.uid,
    portal_usuario: payload.usuario,
    comuna_id: payload.comuna,
    user_id: userId,
    jti: payload.jti,
  });

  if (error) {
    console.error(
      `[sso] NO se pudo registrar el acceso de uid=${payload.uid} (${payload.usuario}), ` +
        `comuna ${payload.comuna}: ${error.message}. ` +
        `¿Corriste supabase/011_sso_accesos.sql?`
    );
  }
}
