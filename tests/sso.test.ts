/**
 * Puente de sesión con el Portal — casos de rechazo.
 *   npm run test:sso
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Qué prueba y por qué existe
 * ─────────────────────────────────────────────────────────────────────────
 * Que el pase falle CERRADO. Que un token válido funcione se nota enseguida —
 * el botón anda o no anda. Lo que no se nota nunca es que un token vencido,
 * reusado o con la firma cambiada siga entrando: no hay síntoma, no hay error
 * en pantalla, y el día que importe va a ser tarde.
 *
 * Este puente es lo único que puede abrir una sesión en Reclamos sin que nadie
 * escriba una contraseña, así que su superficie de fallo merece un test propio.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * El firmador de acá es una COPIA del del Portal
 * ─────────────────────────────────────────────────────────────────────────
 * `firmar()` reproduce a mano el formato de `lib/sso-reclamos.ts` del repo
 * `portal-crm`. No se puede importar: son dos repos separados.
 *
 * Eso tiene una consecuencia que conviene tener clara: este test verifica que
 * `verificarYConsumir` cumple EL CONTRATO, no que el Portal lo esté emitiendo
 * bien. Si alguien cambia el formato allá y no acá, este test sigue en verde y
 * el SSO igual se cae en producción. La red que cubre ese caso es el campo `v`
 * del payload, que hace que un desfasaje se rechace explícitamente en vez de
 * interpretarse mal — y el caso "version" de acá abajo prueba justamente eso.
 */
import assert from "node:assert";

// Antes de cualquier llamada: el módulo lee el secreto en cada firma, no al
// importarse, así que alcanza con definirlo acá arriba.
process.env.SSO_BRIDGE_SECRET = "x".repeat(64);

import { verificarYConsumir, SSO_VERSION, emailDeUsuarioPortal } from "../src/lib/sso";

let pasados = 0;
const fallos: string[] = [];

async function test(nombre: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    pasados++;
    console.log(`  ✓ ${nombre}`);
  } catch (e) {
    fallos.push(`${nombre}: ${(e as Error).message}`);
    console.log(`  ✗ ${nombre}`);
  }
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string, secreto = process.env.SSO_BRIDGE_SECRET!): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secreto),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return b64url(new Uint8Array(sig));
}

let contador = 0;

/** Arma un token como lo armaría el Portal. `over` permite romperlo a propósito. */
async function firmar(over: Record<string, unknown> = {}, secreto?: string): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = {
    v: SSO_VERSION,
    uid: 42,
    usuario: "referente.comuna4",
    comuna: 4,
    // Un jti distinto por token: si todos compartieran uno, el segundo test que
    // firmara daría "reusado" y el motivo real quedaría tapado.
    jti: `jti-${++contador}`,
    iat: ahora,
    exp: ahora + 60,
    ...over,
  };
  const cuerpo = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${cuerpo}.${await hmac(cuerpo, secreto)}`;
}

async function main() {
  console.log("\nPuente de sesión con el Portal\n");

  await test("un pase recién emitido se acepta y trae la identidad", async () => {
    const r = await verificarYConsumir(await firmar());
    assert.strictEqual(r.ok, true, `rechazado con motivo "${r.motivo}"`);
    assert.strictEqual(r.payload?.uid, 42);
    assert.strictEqual(r.payload?.comuna, 4);
  });

  await test("el mismo pase NO se puede canjear dos veces", async () => {
    const token = await firmar();

    const primero = await verificarYConsumir(token);
    assert.strictEqual(primero.ok, true, "el primer canje tendría que funcionar");

    const segundo = await verificarYConsumir(token);
    assert.strictEqual(segundo.ok, false, "el segundo canje NO tendría que funcionar");
    assert.strictEqual(segundo.motivo, "reusado");
  });

  await test("una firma alterada se rechaza", async () => {
    const token = await firmar();
    // Cambiar UN carácter de la firma. Es el caso realista: alguien copia el
    // token del historial y lo edita.
    const roto = token.slice(0, -1) + (token.at(-1) === "A" ? "B" : "A");
    const r = await verificarYConsumir(roto);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.motivo, "firma");
  });

  await test("un pase firmado con OTRO secreto se rechaza", async () => {
    // El caso de rotar el secreto en un solo lado, o de alguien que se arma el
    // token sin tenerlo.
    const r = await verificarYConsumir(await firmar({}, "y".repeat(64)));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.motivo, "firma");
  });

  await test("un payload modificado invalida la firma (no se puede subir de comuna)", async () => {
    // El ataque obvio: cambiar `comuna: 4` por `comuna: 1` para ver los
    // reclamos de otra. Como la firma cubre el payload entero, no compila.
    const token = await firmar();
    const [cuerpo, firma] = token.split(".");
    const payload = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
    payload.comuna = 1;
    const cuerpoFalso = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

    const r = await verificarYConsumir(`${cuerpoFalso}.${firma}`);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.motivo, "firma");
  });

  await test("un pase vencido se rechaza", async () => {
    const ahora = Math.floor(Date.now() / 1000);
    const r = await verificarYConsumir(await firmar({ iat: ahora - 300, exp: ahora - 1 }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.motivo, "vencido");
  });

  await test("un pase con vida demasiado larga se rechaza", async () => {
    // Alguien con el secreto emitiendo un pase de un día, o el Portal con el
    // TTL cambiado sin avisar. El contrato son 60 segundos y se hace cumplir
    // del lado que verifica, no solo del que firma.
    const ahora = Math.floor(Date.now() / 1000);
    const r = await verificarYConsumir(await firmar({ exp: ahora + 86400 }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.motivo, "vencido");
  });

  await test("una versión de payload distinta se rechaza", async () => {
    const r = await verificarYConsumir(await firmar({ v: SSO_VERSION + 1 }));
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.motivo, "version");
  });

  await test("una comuna fuera de 1..15 se rechaza", async () => {
    for (const comuna of [0, 16, -1, 99]) {
      const r = await verificarYConsumir(await firmar({ comuna }));
      assert.strictEqual(r.ok, false, `comuna ${comuna} no tendría que pasar`);
      assert.strictEqual(r.motivo, "payload");
    }
  });

  await test("basura y vacío se rechazan sin explotar", async () => {
    for (const t of ["", null, undefined, "sinpunto", ".", "a.b", "....."]) {
      const r = await verificarYConsumir(t as string);
      assert.strictEqual(r.ok, false, `"${t}" no tendría que pasar`);
    }
  });

  await test("el email de la cuenta se ancla al id, no al username", () => {
    // Si se anclara al username, renombrar a alguien en el Portal le crearía
    // una cuenta NUEVA acá y perdería el rastro de todo lo que cargó.
    assert.strictEqual(emailDeUsuarioPortal(42), "u42@portal.reclamos.gob.ar");
    assert.strictEqual(emailDeUsuarioPortal(7), "u7@portal.reclamos.gob.ar");
    assert.notStrictEqual(emailDeUsuarioPortal(42), emailDeUsuarioPortal(43));
  });

  if (fallos.length) {
    console.log(`\n${fallos.length} FALLARON:\n`);
    for (const f of fallos) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log(`\n${pasados} tests OK\n`);
}

main();
