"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_DOCUMENTOS, BUCKET_FOTOS, urlDeArchivo } from "@/lib/archivoUrl";
import { numeroWhatsApp, telefonoParaLlamar } from "@/lib/telefonos";
import {
  ESTADOS_RECLAMO,
  ESTADOS_SUGERENCIA,
  estadoReclamo,
  estadoSugerencia,
  URGENCIA_COLORS,
} from "@/lib/estados";
import type { Reclamo, Sugerencia } from "@/types";

/**
 * Ficha de un reclamo o de una sugerencia.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Qué resuelve
 * ─────────────────────────────────────────────────────────────────────────
 * Dos cosas que estaban pendientes, y conviene que sea la misma pieza:
 *
 * 1. **El detalle no existía.** La tabla del panel muestra siete columnas y
 *    ninguna es la descripción, que es el texto que explica cuál es el
 *    problema. Para leerlo había que ir a Supabase.
 *
 * 2. **El cambio de estado tampoco** (`DOCUMENTACION.md` §10.2: "las RLS de
 *    UPDATE ya lo permiten; falta exponerlo en la interfaz"). O sea que los 177
 *    reclamos cargados están todos en `nuevo` — no porque nadie los haya
 *    resuelto, sino porque no había dónde decirlo.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Por qué a pantalla completa en el teléfono
 * ─────────────────────────────────────────────────────────────────────────
 * Mismo patrón que la ficha de persona del Portal. En 375px un panel lateral
 * no entra y un acordeón adentro de la lista empuja todo lo demás fuera de
 * pantalla: tocás un reclamo y "no pasa nada" visible, que es el error que el
 * Portal cometió tres veces (`ADAPTACION-MOVIL.md` §4.1).
 *
 * Tres detalles que la hacen usable y que no se notan hasta que faltan:
 * el scroll del fondo bloqueado, la barra de volver pegada arriba (se puede
 * salir desde cualquier punto del scroll), y la posición de la lista
 * conservada al cerrar.
 */

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Un solo componente para las dos entidades
 * ─────────────────────────────────────────────────────────────────────────
 * Reclamos y sugerencias comparten estructura casi entera (tipo, urgencia,
 * descripción, contacto, dirección, adjuntos) y difieren en cuatro cosas: la
 * tabla, el nombre del campo de tipo, el vocabulario de estados y el bucket de
 * Storage. Eso es una config, no un componente aparte.
 *
 * La alternativa —copiar esto y cambiarle cuatro strings— es exactamente lo
 * que ya pasó en este repo con las URLs de archivos, que terminaron armadas de
 * dos formas distintas en dos archivos. Con dos copias, el día que alguien
 * arregle el link de WhatsApp, lo arregla en una.
 */
export type VarianteFicha = "reclamo" | "sugerencia";

const CONFIG = {
  reclamo: {
    tabla: "reclamos",
    bucket: BUCKET_FOTOS,
    estados: ESTADOS_RECLAMO,
    resolver: estadoReclamo,
    // Las dos entidades guardan el mismo dato con distinto nombre de columna y
    // distinto rótulo en la UI. Se lee con una función y no con el nombre del
    // campo como string: así TypeScript verifica que la columna existe en la
    // entidad correspondiente, en vez de castear a `Record<string, unknown>` y
    // perder el chequeo justo donde las dos formas se confunden.
    tipo: (r: Registro) => (r as Reclamo).tipo_reclamo,
    rotuloUrgencia: "Urgencia",
  },
  sugerencia: {
    tabla: "sugerencias",
    bucket: BUCKET_DOCUMENTOS,
    estados: ESTADOS_SUGERENCIA,
    resolver: estadoSugerencia,
    tipo: (r: Registro) => (r as Sugerencia).tipo_sugerencia,
    rotuloUrgencia: "Importancia",
  },
} as const;

/** Lo que la ficha necesita, independiente de cuál de las dos entidades sea. */
type Registro = Reclamo | Sugerencia;

interface Props {
  registro: Registro;
  variante: VarianteFicha;
  onCerrar: () => void;
}

export default function FichaDetalle({ registro: reclamo, variante, onCerrar }: Props) {
  const cfg = CONFIG[variante];
  const router = useRouter();
  const [estado, setEstado] = useState<string>(reclamo.estado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // La posición del listado al abrir. Se guarda en un ref y no en estado
  // porque cambiarla no tiene que redibujar nada — y sobre todo porque leerla
  // en el render daría el valor de DESPUÉS de bloquear el scroll.
  const scrollPrevio = useRef(0);

  useEffect(() => {
    scrollPrevio.current = window.scrollY;
    document.body.classList.add("sin-scroll");

    // Escape cierra. Es gratis y es lo que espera cualquiera en escritorio.
    function alTeclear(e: KeyboardEvent) {
      if (e.key === "Escape") onCerrar();
    }
    window.addEventListener("keydown", alTeclear);

    return () => {
      document.body.classList.remove("sin-scroll");
      window.removeEventListener("keydown", alTeclear);
      // `overflow: hidden` en el body descarta la posición de scroll: sin esto
      // el usuario vuelve al principio del listado después de mirar el reclamo
      // 17. Va en el mismo `requestAnimationFrame` que el repintado para que no
      // se vea el salto.
      requestAnimationFrame(() => window.scrollTo(0, scrollPrevio.current));
    };
  }, [onCerrar]);

  async function guardarEstado(nuevo: string) {
    if (nuevo === estado || guardando) return;

    const anterior = estado;
    // Optimista: el select ya muestra lo elegido. Si el UPDATE falla se vuelve
    // atrás — mostrar el estado nuevo sobre una base que no cambió sería peor
    // que no dejarlo cambiar.
    setEstado(nuevo);
    setGuardando(true);
    setError(null);

    const supabase = createClient();
    const { error: err } = await supabase
      .from(cfg.tabla)
      .update({ estado: nuevo })
      .eq("id", reclamo.id);

    setGuardando(false);

    if (err) {
      setEstado(anterior);
      // La RLS de UPDATE filtra por comuna. Si esto falla no es un problema de
      // red: es que el reclamo no es de la comuna del usuario, y decirlo así
      // es más útil que el mensaje de PostgREST.
      setError(err.message || "No se pudo guardar el estado.");
      return;
    }

    // El listado de atrás es un Server Component: sin esto sigue mostrando el
    // estado viejo hasta que alguien recargue.
    router.refresh();
  }

  const est = cfg.resolver(estado);
  const tipo = cfg.tipo(reclamo);
  const direccion = reclamo.direccion_normalizada ?? reclamo.direccion_raw;
  const wa = numeroWhatsApp(reclamo.telefono_contacto);
  const tel = telefonoParaLlamar(reclamo.telefono_contacto);
  const fotos = reclamo.reclamo_archivos ?? [];

  return (
    <div
      // `fixed inset-0` en las dos formas. En teléfono es la pantalla entera;
      // de `md` para arriba el fondo oscurecido deja ver el listado detrás, que
      // es lo que hace que se lea como "detalle de esta fila" y no como otra
      // página.
      className="fixed inset-0 z-50 bg-black md:bg-black/80 md:backdrop-blur-sm md:flex md:items-center md:justify-center md:p-6"
      onClick={(e) => {
        // Solo el fondo cierra, y solo en escritorio: en el teléfono no hay
        // fondo visible y un tap perdido cerraría la ficha sin explicación.
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div className="h-full w-full overflow-y-auto bg-black md:h-auto md:max-h-[85vh] md:max-w-2xl md:rounded-xl md:border md:border-card-border">
        {/*
          Barra pegajosa. `safe-top` mete el inset del notch en el padding
          superior; sin eso, con la app instalada el botón de volver queda
          debajo del reloj. `--safe-base` es el padding normal, al que la clase
          le suma el inset.
        */}
        <div
          className="safe-top sticky top-0 z-10 flex items-center gap-3 border-b border-card-border bg-black/95 px-4 pb-3 backdrop-blur"
          style={{ ["--safe-base" as string]: "0.75rem" }}
        >
          <button
            type="button"
            onClick={onCerrar}
            // 44px de alto y de ancho: el mínimo táctil cómodo. Un botón de
            // volver chico es el que más se falla, porque se toca al apuro.
            className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl text-muted transition-colors hover:bg-white/5 hover:text-white"
            aria-label="Volver al listado"
          >
            ←
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold uppercase tracking-wide text-white">
              {tipo}
            </div>
            <div className="truncate text-[11px] text-muted">
              {new Date(reclamo.created_at).toLocaleDateString("es-AR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </div>
          </div>
          <span
            // Las sugerencias llaman "Importancia" al mismo campo. El badge
            // muestra solo el valor (ALTA/MEDIA/BAJA) porque el rótulo no entra
            // en 375px, así que va en el `title`.
            title={cfg.rotuloUrgencia}
            className={`shrink-0 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${URGENCIA_COLORS[reclamo.urgencia] ?? ""}`}
          >
            {reclamo.urgencia}
          </span>
        </div>

        <div className="safe-bottom space-y-6 px-4 py-5" style={{ ["--safe-base" as string]: "1.25rem" }}>
          {/* ───── Estado ───── */}
          <section>
            <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">
              Estado
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${est.clase}`}
              >
                {est.label}
              </span>
              <select
                value={estado}
                disabled={guardando}
                onChange={(e) => guardarEstado(e.target.value)}
                // `h-11` = 44px. Es el control que ESCRIBE en la base, así que
                // es el que menos puede tocarse por accidente: por eso va en
                // una fila propia y no pegado al botón de volver.
                className="lla-input h-11 flex-1 px-3 text-sm disabled:opacity-50"
                aria-label="Cambiar estado"
              >
                {cfg.estados.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.label}
                  </option>
                ))}
              </select>
            </div>
            {guardando ? (
              <p className="mt-2 text-xs text-muted">Guardando…</p>
            ) : null}
            {error ? (
              <p className="mt-2 text-xs text-red-400">{error}</p>
            ) : null}
          </section>

          <Campo titulo="Dirección">
            <p className="text-sm text-white">{direccion || "—"}</p>
            {reclamo.lat && reclamo.lng ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${reclamo.lat},${reclamo.lng}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex h-11 items-center rounded-lg border border-card-border px-3 text-xs font-bold uppercase tracking-wider text-primary transition-colors hover:bg-white/5"
              >
                Cómo llegar
              </a>
            ) : (
              // El reclamo se pudo guardar sin coordenadas (la cadena de
              // geocodificación puede fallar entera). Decirlo explícitamente
              // evita la conclusión de que el mapa está roto.
              <p className="mt-1 text-xs text-red-400">Sin coordenadas: no aparece en el mapa.</p>
            )}
          </Campo>

          <Campo titulo="Descripción">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">
              {reclamo.descripcion || "—"}
            </p>
          </Campo>

          <Campo titulo="Contacto">
            <p className="text-sm text-white">{reclamo.nombre_contacto || "—"}</p>
            <p className="text-sm text-muted">{reclamo.telefono_contacto || "Sin teléfono"}</p>
            {tel || wa ? (
              <div className="mt-3 flex gap-2">
                {tel ? (
                  <a
                    href={`tel:${tel}`}
                    className="flex h-11 flex-1 items-center justify-center rounded-lg border border-card-border text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-white/5"
                  >
                    Llamar
                  </a>
                ) : null}
                {/*
                  Si `numeroWhatsApp` devuelve null NO se muestra el botón. Ver
                  el encabezado de `lib/telefonos.ts`: un link mal armado abre
                  un chat con un desconocido y nadie se entera.
                */}
                {wa ? (
                  <a
                    href={`https://wa.me/${wa}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-11 flex-1 items-center justify-center rounded-lg border border-green-900/40 bg-green-950/30 text-xs font-bold uppercase tracking-wider text-green-500 transition-colors hover:bg-green-950/60"
                  >
                    WhatsApp
                  </a>
                ) : null}
              </div>
            ) : null}
          </Campo>

          {fotos.length > 0 ? (
            <Campo titulo={`Adjuntos (${fotos.length})`}>
              <div className="grid grid-cols-3 gap-2">
                {fotos.map((f) => (
                  <a
                    key={f.id}
                    // Siempre origen "mapa": el panel comunal solo muestra los
                    // reclamos propios; los de MTR son de solo lectura y viven
                    // únicamente en /public.
                    href={urlDeArchivo("mapa", f, cfg.bucket)}
                    target="_blank"
                    rel="noreferrer"
                    // Cuadrado de ~1/3 del ancho: en 375px son ~110px de lado,
                    // muy por encima de los 44px mínimos y suficiente para
                    // reconocer la foto sin abrirla.
                    className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-card-border bg-black/60 text-2xl transition-colors hover:border-primary"
                    title={f.tipo === "foto" ? "Ver foto" : "Ver documento"}
                  >
                    {f.tipo === "foto" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={urlDeArchivo("mapa", f, cfg.bucket)}
                        alt="Foto adjunta"
                        loading="lazy"
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      "📄"
                    )}
                  </a>
                ))}
              </div>
            </Campo>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Campo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted">{titulo}</h2>
      {children}
    </section>
  );
}
