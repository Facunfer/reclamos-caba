/**
 * Armado de links de contacto a partir de `telefono_contacto`.
 *
 * Portado de `lib/telefonos.ts` del Portal Territorial (repo `portal-crm`),
 * donde el problema ya se cometió una vez y está documentado en su
 * `ADAPTACION-MOVIL.md` §4.2. Se copia en vez de compartirse porque las dos
 * apps son procesos y repos separados; si alguna vez divergen, este comentario
 * es el que avisa dónde está la otra copia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Por qué esto es delicado, y por qué prefiere no mostrar el botón
 * ─────────────────────────────────────────────────────────────────────────
 * `telefono_contacto` es el teléfono del VECINO que hizo el reclamo, cargado a
 * mano por un usuario comunal mientras hablaba con él. En la misma columna
 * conviven "11 4567-8901", "1544445555", "+54 9 11 2233-4455" y
 * "011 15 4444-5555".
 *
 * `wa.me` quiere un número internacional sin signos: para un celular argentino
 * es `54` + `9` + área + abonado, SIN el `0` de larga distancia y SIN el `15`.
 * Traducir mal no da un error visible: abre un chat con OTRO número, que puede
 * ser el de una persona real ajena a todo esto. El referente le escribiría a un
 * desconocido sobre un bache creyendo que le escribe al vecino que lo reportó,
 * y del lado del sistema no queda ningún rastro.
 *
 * Por eso la función es conservadora: cubre los formatos de CABA que
 * efectivamente aparecen en la base y devuelve `null` para todo lo demás. Sin
 * botón de WhatsApp queda el de llamar, que es seguro: el discador entiende los
 * formatos locales y además el usuario ve el número antes de marcar.
 *
 * Menos botones es mejor que un botón que manda al lugar equivocado.
 *
 * El área 11 se asume solo cuando el número viene en formato local sin área.
 * Es válido acá porque el sistema es de CABA y solo de CABA — las 15 comunas.
 */

/** Código de país de Argentina. */
const PAIS = "54";
/** Prefijo de celular que exige WhatsApp para Argentina. */
const CELULAR = "9";
/** Área de CABA, la única que se asume cuando el número viene sin área. */
const AREA_CABA = "11";

/**
 * Devuelve el número listo para `https://wa.me/<numero>`, o `null` si no se
 * puede afirmar cuál es.
 */
export function numeroWhatsApp(valor: unknown): string | null {
  const crudo = String(valor ?? "").replace(/\D/g, "");
  if (!crudo) return null;

  // Ya viene internacional: se respeta tal cual. Si alguien se tomó el trabajo
  // de escribir el código de país, sabe mejor que esta función.
  if (crudo.startsWith(PAIS)) return crudo;

  // "011 …" → "11 …". El 0 es de larga distancia nacional y no va en el
  // formato internacional.
  const n = crudo.replace(/^0/, "");

  // 11 15 4444-5555 → área + 15 + abonado
  if (/^1115\d{8}$/.test(n)) return PAIS + CELULAR + AREA_CABA + n.slice(4);

  // 11 4567-8901 → área + abonado
  if (/^11\d{8}$/.test(n)) return PAIS + CELULAR + n;

  // 15 4444-5555 → celular de CABA escrito sin área
  if (/^15\d{8}$/.test(n)) return PAIS + CELULAR + AREA_CABA + n.slice(2);

  // Cualquier otra cosa —un fijo de 8 dígitos sin área, un número de otra
  // provincia, algo incompleto— no se adivina.
  return null;
}

/**
 * Número para un `tel:`, o `null` si no hay nada que marcar.
 *
 * Mucho más permisivo que `numeroWhatsApp` a propósito, y no es una
 * inconsistencia: acá el riesgo es otro. `tel:` abre el discador con el número
 * a la vista y espera que la persona toque "llamar", así que un número raro se
 * ve antes de que pase nada. WhatsApp, en cambio, abre la conversación sola.
 */
export function telefonoParaLlamar(valor: unknown): string | null {
  const crudo = String(valor ?? "").replace(/[^\d+]/g, "");
  // Menos de 6 dígitos no es un teléfono, es un resto de carga (un "-", un
  // "s/d" que quedó a medias).
  return crudo.replace(/\D/g, "").length >= 6 ? crudo : null;
}
