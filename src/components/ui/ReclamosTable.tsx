// src/components/ui/ReclamosTable.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import FichaDetalle from "@/components/ui/FichaDetalle";
import { urlDeArchivo } from "@/lib/archivoUrl";
import { estadoReclamo, URGENCIA_COLORS } from "@/lib/estados";
import type { Reclamo } from "@/types";

/**
 * Listado de reclamos del panel comunal.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Dos formas según el ancho, y una sola ficha
 * ─────────────────────────────────────────────────────────────────────────
 * De `md` (768px) para arriba, la tabla de siempre: siete columnas, sin un
 * pixel cambiado. Abajo de eso, tarjetas — la tabla necesita ~900px y en un
 * iPhone quedaba con scroll horizontal, que es la peor forma de leer una lista
 * (se pierde la columna de referencia al desplazarse).
 *
 * Se esconde con CSS (`hidden md:block` / `md:hidden`) y no montando
 * condicionalmente en JavaScript. La regla del Portal: montar condicionalmente
 * se justifica cuando lo escondido pesa cientos de kB, y acá los dos árboles
 * son HTML de la misma lista ya cargada. Con CSS el servidor manda el marcado
 * correcto para los dos anchos y no hay parpadeo al hidratar.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Qué va en la tarjeta y qué no
 * ─────────────────────────────────────────────────────────────────────────
 * Lo que sirve **parado en la calle**: tipo, urgencia, estado, dirección y
 * fecha. Queda afuera lo que no cambia ninguna decisión ahí: el UUID, el
 * `creado_por_user_id`, y el nombre y teléfono del vecino — este último además
 * es un dato personal que no tiene por qué estar a la vista en una lista que se
 * scrollea en la vía pública. Todo eso sigue en la ficha, a un toque.
 *
 * El estado, que la tabla nunca mostró, es justamente el campo que decide si
 * hay algo que hacer con ese reclamo. Va en la tarjeta.
 */

export default function ReclamosTable({ reclamos }: { reclamos: Reclamo[] }) {
  // La ficha se abre en los dos anchos: en el teléfono ocupa la pantalla, en
  // escritorio es un panel centrado. Es también el único lugar donde se puede
  // cambiar el estado de un reclamo, que hasta ahora no existía en ningún lado.
  const [seleccionado, setSeleccionado] = useState<Reclamo | null>(null);

  if (!reclamos.length) {
    return (
      <div className="lla-card text-center text-muted py-16">
        No hay reclamos aún.{" "}
        <Link href="/panel/nuevo" className="text-primary hover:underline font-bold">
          Crear el primero
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* ═══════════ Escritorio ═══════════ */}
      <div className="hidden md:block lla-card overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-black/40 text-left text-[10px] text-muted uppercase tracking-[0.2em] font-bold border-b border-card-border">
              <th className="px-6 py-4">Fecha</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Urgencia</th>
              <th className="px-6 py-4">Dirección</th>
              <th className="px-6 py-4">Geo</th>
              <th className="px-6 py-4">Archivos</th>
              <th className="px-6 py-4">Contacto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-card-border">
            {reclamos.map((r) => (
              <tr
                key={r.id}
                // La fila ya tenía `hover:bg`, así que la afordancia de "esto
                // responde" estaba; ahora además hace algo. No se agregó una
                // columna "Ver" a propósito: eso sí habría cambiado el layout
                // de escritorio, que es lo único que esta tanda no toca.
                onClick={() => setSeleccionado(r)}
                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <td className="px-6 py-5 whitespace-nowrap text-muted font-medium">
                  {new Date(r.created_at).toLocaleDateString("es-AR")}
                </td>
                <td className="px-6 py-5 font-bold text-white">{r.tipo_reclamo}</td>
                <td className="px-6 py-5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${URGENCIA_COLORS[r.urgencia]}`}
                  >
                    {r.urgencia}
                  </span>
                </td>
                <td className="px-6 py-5 max-w-xs truncate text-muted">
                  {r.direccion_normalizada ?? r.direccion_raw}
                </td>
                <td className="px-6 py-5 text-center">
                  {r.lat && r.lng ? (
                    <span className="text-primary text-base">●</span>
                  ) : (
                    <span className="text-red-900/50 text-xs">ERR</span>
                  )}
                </td>
                <td className="px-6 py-5">
                  {r.reclamo_archivos && r.reclamo_archivos.length > 0 ? (
                    <div className="flex gap-1 flex-wrap">
                      {r.reclamo_archivos.map((file) => (
                        <a
                          key={file.id}
                          href={urlDeArchivo("mapa", file)}
                          target="_blank"
                          rel="noreferrer"
                          // Sin esto, abrir un adjunto abre TAMBIÉN la ficha
                          // detrás: el click sube hasta el <tr>.
                          onClick={(e) => e.stopPropagation()}
                          className="w-10 h-10 flex items-center justify-center overflow-hidden bg-indigo-900/50 text-indigo-400 rounded hover:ring-2 hover:ring-primary transition-all border border-indigo-700/50"
                          title={file.tipo === "foto" ? "Ver foto" : "Ver documento"}
                        >
                          {file.tipo === "foto" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={urlDeArchivo("mapa", file)}
                              alt="Foto del reclamo"
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            "📄"
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted/30">-</span>
                  )}
                </td>
                <td className="px-6 py-5">
                  <div className="text-[10px] uppercase font-bold tracking-tight">
                    <div className="text-white">{r.nombre_contacto || "-"}</div>
                    <div className="text-muted">{r.telefono_contacto || "-"}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════ Teléfono ═══════════ */}
      <ul className="md:hidden flex flex-col gap-3">
        {reclamos.map((r) => {
          const est = estadoReclamo(r.estado);
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSeleccionado(r)}
                // `text-left` porque un <button> centra el texto por defecto y
                // acá adentro hay un bloque, no una etiqueta.
                className="lla-card w-full text-left p-4 active:border-primary/60 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-bold text-white text-sm leading-tight">
                    {r.tipo_reclamo}
                  </span>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${URGENCIA_COLORS[r.urgencia]}`}
                  >
                    {r.urgencia}
                  </span>
                </div>

                <p className="mt-2 text-sm text-muted leading-snug">
                  {r.direccion_normalizada ?? r.direccion_raw}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                  <span
                    className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${est.clase}`}
                  >
                    {est.label}
                  </span>
                  <span className="text-muted">
                    {new Date(r.created_at).toLocaleDateString("es-AR")}
                  </span>
                  {/*
                    "Sin geo" es la única bandera de error que se muestra en la
                    lista: significa que el reclamo NO va a aparecer en el mapa
                    público, y es corregible. El resto de los diagnósticos van
                    en la ficha.
                  */}
                  {!(r.lat && r.lng) ? (
                    <span className="text-red-400">· sin geo</span>
                  ) : null}
                </div>

                {/* Miniaturas: se ven las fotos sin abrir la ficha. */}
                {(() => {
                  const fotos = (r.reclamo_archivos ?? []).filter((f) => f.tipo === "foto");
                  const otros = (r.reclamo_archivos?.length ?? 0) - fotos.length;
                  if (!fotos.length && !otros) return null;
                  return (
                    <div className="mt-3 flex items-center gap-2">
                      {fotos.slice(0, 4).map((f) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={f.id}
                          src={urlDeArchivo("mapa", f)}
                          alt="Foto del reclamo"
                          loading="lazy"
                          className="w-14 h-14 rounded-lg object-cover border border-card-border"
                        />
                      ))}
                      {fotos.length > 4 ? (
                        <span className="text-[10px] text-muted">+{fotos.length - 4}</span>
                      ) : null}
                      {otros > 0 ? (
                        <span className="text-[10px] text-muted">· {otros} doc.</span>
                      ) : null}
                    </div>
                  );
                })()}
              </button>
            </li>
          );
        })}
      </ul>

      {seleccionado ? (
        <FichaDetalle
          registro={seleccionado}
          variante="reclamo"
          onCerrar={() => setSeleccionado(null)}
        />
      ) : null}
    </>
  );
}
