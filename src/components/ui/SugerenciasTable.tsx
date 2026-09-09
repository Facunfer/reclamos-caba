// src/components/ui/SugerenciasTable.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import FichaDetalle from "@/components/ui/FichaDetalle";
import { BUCKET_DOCUMENTOS, urlDeArchivo } from "@/lib/archivoUrl";
import { estadoSugerencia, URGENCIA_COLORS } from "@/lib/estados";
import type { Sugerencia } from "@/types";

/**
 * Listado de sugerencias del panel comunal.
 *
 * Espejo de `ReclamosTable` — leer el comentario largo de ese archivo para el
 * porqué de las dos formas según el ancho y de qué campos van en la tarjeta.
 * Las diferencias son de vocabulario, no de criterio:
 *
 *   · "Categoría" e "Importancia" en vez de "Tipo" y "Urgencia".
 *   · Estados propios (`nuevo → en_evaluacion → aprobado/rechazado`).
 *   · La dirección es OPCIONAL: una sugerencia puede no tener lugar. Por eso
 *     "sin geo" no se marca como error acá, a diferencia de un reclamo, donde
 *     significa que no va a salir en el mapa.
 */

export default function SugerenciasTable({ sugerencias }: { sugerencias: Sugerencia[] }) {
    const [seleccionada, setSeleccionada] = useState<Sugerencia | null>(null);

    if (!sugerencias.length) {
        return (
            <div className="lla-card text-center text-muted py-16">
                No hay sugerencias aún.{" "}
                <Link href="/panel/sugerencias/nuevo" className="text-primary hover:underline font-bold">
                    Crear la primera
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
                            <th className="px-6 py-4">Categoría</th>
                            <th className="px-6 py-4">Importancia</th>
                            <th className="px-6 py-4">Dirección (Opcional)</th>
                            <th className="px-6 py-4">Geo</th>
                            <th className="px-6 py-4">Archivos</th>
                            <th className="px-6 py-4">Contacto</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-card-border">
                        {sugerencias.map((s) => (
                            <tr
                                key={s.id}
                                onClick={() => setSeleccionada(s)}
                                className="cursor-pointer hover:bg-white/[0.02] transition-colors"
                            >
                                <td className="px-6 py-5 whitespace-nowrap text-muted font-medium">
                                    {new Date(s.created_at).toLocaleDateString("es-AR")}
                                </td>
                                <td className="px-6 py-5 font-bold text-white">{s.tipo_sugerencia}</td>
                                <td className="px-6 py-5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${URGENCIA_COLORS[s.urgencia]}`}>
                                        {s.urgencia}
                                    </span>
                                </td>
                                <td className="px-6 py-5 max-w-xs truncate text-muted">{s.direccion_normalizada ?? s.direccion_raw ?? "-"}</td>
                                <td className="px-6 py-5 text-center">
                                    {s.lat && s.lng ? (
                                        <span className="text-primary text-base">●</span>
                                    ) : (
                                        <span className="text-muted text-xs">-</span>
                                    )}
                                </td>
                                <td className="px-6 py-5">
                                    {s.reclamo_archivos && s.reclamo_archivos.length > 0 ? (
                                        <div className="flex gap-1 flex-wrap">
                                            {s.reclamo_archivos.map((file) => (
                                                <a
                                                    key={file.id}
                                                    href={urlDeArchivo("mapa", file, BUCKET_DOCUMENTOS)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    // El click no tiene que subir hasta la fila y abrir
                                                    // la ficha además del archivo.
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-5 h-5 flex items-center justify-center bg-indigo-900/50 text-indigo-400 rounded hover:bg-indigo-700 hover:text-white transition-colors border border-indigo-700/50"
                                                    title="Ver archivo"
                                                >
                                                    {file.tipo === 'foto' ? '🖼️' : file.tipo === 'pdf' ? '📕' : '📄'}
                                                </a>
                                            ))}
                                        </div>
                                    ) : <span className="text-muted/30">-</span>}
                                </td>
                                <td className="px-6 py-5">
                                    <div className="text-[10px] uppercase font-bold tracking-tight">
                                        <div className="text-white">{s.nombre_contacto || "-"}</div>
                                        <div className="text-muted">{s.telefono_contacto || "-"}</div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ═══════════ Teléfono ═══════════ */}
            <ul className="md:hidden flex flex-col gap-3">
                {sugerencias.map((s) => {
                    const est = estadoSugerencia(s.estado);
                    const direccion = s.direccion_normalizada ?? s.direccion_raw;
                    return (
                        <li key={s.id}>
                            <button
                                type="button"
                                onClick={() => setSeleccionada(s)}
                                className="lla-card w-full text-left p-4 active:border-primary/60 transition-colors"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="font-bold text-white text-sm leading-tight">
                                        {s.tipo_sugerencia}
                                    </span>
                                    <span className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${URGENCIA_COLORS[s.urgencia]}`}>
                                        {s.urgencia}
                                    </span>
                                </div>

                                {/*
                                  Sin dirección no se deja el renglón vacío: en una
                                  tarjeta de teléfono cada línea muerta empuja la
                                  sugerencia siguiente fuera de pantalla.
                                */}
                                {direccion ? (
                                    <p className="mt-2 text-sm text-muted leading-snug">{direccion}</p>
                                ) : null}

                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                                    <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${est.clase}`}>
                                        {est.label}
                                    </span>
                                    <span className="text-muted">
                                        {new Date(s.created_at).toLocaleDateString("es-AR")}
                                    </span>
                                    {s.reclamo_archivos && s.reclamo_archivos.length > 0 ? (
                                        <span className="text-muted">· {s.reclamo_archivos.length} adj.</span>
                                    ) : null}
                                </div>
                            </button>
                        </li>
                    );
                })}
            </ul>

            {seleccionada ? (
                <FichaDetalle
                    registro={seleccionada}
                    variante="sugerencia"
                    onCerrar={() => setSeleccionada(null)}
                />
            ) : null}
        </>
    );
}
