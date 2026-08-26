"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { OpcionSubtipo } from "@/hooks/useReclamosFiltrados";

interface Props {
  opciones: OpcionSubtipo[];
  seleccionados: string[];
  onChange: (subtipos: string[]) => void;
}

export default function SubtipoMultiSelect({ opciones, seleccionados, onChange }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  // Cerrar al hacer clic afuera
  useEffect(() => {
    if (!abierto) return;
    const handler = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  // Si cambian las opciones disponibles (p.ej. al filtrar por tipo), se
  // descartan los subtipos seleccionados que ya no existen en el dataset.
  useEffect(() => {
    if (seleccionados.length === 0) return;
    const disponibles = new Set(opciones.map((o) => o.subtipo));
    const vigentes = seleccionados.filter((s) => disponibles.has(s));
    if (vigentes.length !== seleccionados.length) onChange(vigentes);
  }, [opciones, seleccionados, onChange]);

  const agrupados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtradas = q
      ? opciones.filter((o) => o.subtipo.toLowerCase().includes(q) || o.tipo.toLowerCase().includes(q))
      : opciones;

    const grupos = new Map<string, OpcionSubtipo[]>();
    for (const o of filtradas) {
      const lista = grupos.get(o.tipo) ?? [];
      lista.push(o);
      grupos.set(o.tipo, lista);
    }
    return Array.from(grupos.entries());
  }, [opciones, busqueda]);

  const toggle = (subtipo: string) => {
    onChange(
      seleccionados.includes(subtipo)
        ? seleccionados.filter((s) => s !== subtipo)
        : [...seleccionados, subtipo]
    );
  };

  const etiqueta =
    seleccionados.length === 0
      ? "Todos"
      : seleccionados.length === 1
        ? seleccionados[0]
        : `${seleccionados.length} seleccionados`;

  return (
    <div className="relative" ref={contenedorRef}>
      <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-1">
        Subtipo
      </label>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        disabled={opciones.length === 0}
        className="lla-input px-3 py-1.5 text-[10px] focus:outline-none cursor-pointer pr-8 text-left min-w-[150px] max-w-[220px] truncate disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {etiqueta}
      </button>

      {abierto && (
        <div className="absolute z-[1100] mt-1 w-[280px] max-h-[320px] overflow-y-auto bg-black border border-card-border rounded shadow-2xl">
          <div className="sticky top-0 bg-black border-b border-card-border p-2">
            <input
              type="text"
              autoFocus
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar subtipo..."
              className="lla-input w-full px-2 py-1.5 text-[10px] focus:outline-none"
            />
            {seleccionados.length > 0 && (
              <button
                onClick={() => onChange([])}
                className="mt-2 w-full text-[9px] text-muted hover:text-white uppercase font-bold tracking-widest border border-card-border px-2 py-1 rounded transition-colors"
              >
                Limpiar selección ({seleccionados.length})
              </button>
            )}
          </div>

          {agrupados.length === 0 && (
            <div className="px-3 py-4 text-[10px] text-muted uppercase font-bold text-center">
              Sin resultados
            </div>
          )}

          {agrupados.map(([tipo, items]) => (
            <div key={tipo}>
              <div className="px-3 py-1.5 text-[9px] font-black text-primary uppercase tracking-widest bg-white/5 sticky top-0">
                {tipo}
              </div>
              {items.map((o) => (
                <label
                  key={`${o.tipo}||${o.subtipo}`}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(o.subtipo)}
                    onChange={() => toggle(o.subtipo)}
                    className="accent-indigo-500 w-3 h-3"
                  />
                  <span className="text-[10px] text-white flex-1 leading-tight">{o.subtipo}</span>
                  <span className="text-[9px] text-muted font-bold">{o.total}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
