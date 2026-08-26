// src/components/PublicPageClient.tsx
"use client";
import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type {
  TipoReclamo,
  BarrasTipoApilada,
  LineaDia,
  ContactoComuna,
  FiltrosUnificados,
  FiltroOrigen,
  ReclamosUnificadosResponse,
} from "@/types";
import { FILTROS_UNIFICADOS_INICIALES, URGENCIA_SIN_DATO } from "@/types";
import { useReclamosFiltrados } from "@/hooks/useReclamosFiltrados";
import SubtipoMultiSelect from "@/components/ui/SubtipoMultiSelect";
import { urlAbsolutaDeArchivo } from "@/lib/archivoUrl";

const MapaLeaflet = dynamic(() => import("@/components/map/MapaLeaflet"), { ssr: false });
const Charts = dynamic(() => import("@/components/charts/Charts"), { ssr: false });

interface Props {
  data: ReclamosUnificadosResponse;
  tipos: TipoReclamo[];
  contactosComunas?: ContactoComuna[];
}

const URGENCIAS = ["BAJA", "MEDIA", "ALTA"];
const COMUNAS = Array.from({ length: 15 }, (_, i) => i + 1);

const ORIGENES: { value: FiltroOrigen; label: string }[] = [
  { value: "todos", label: "Ambos" },
  { value: "mapa", label: "Cargados en el mapa" },
  { value: "mtr", label: "Mandame Tu Reclamo" },
];

export default function PublicPageClient({ data, tipos }: Props) {
  const [filtros, setFiltros] = useState<FiltrosUnificados>(FILTROS_UNIFICADOS_INICIALES);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [activePolygon, setActivePolygon] = useState<[number, number][] | null>(null);

  const { reclamos: filteredReclamos, barriosDisponibles, subtiposDisponibles, totales } =
    useReclamosFiltrados(data.reclamos, filtros, activePolygon);

  // Barras apiladas por origen: el tipo lo identifica la etiqueta del eje X,
  // el color codifica el origen (2 series).
  const barras = useMemo<BarrasTipoApilada[]>(() => {
    const m = new Map<string, BarrasTipoApilada>();
    filteredReclamos.forEach((r) => {
      const fila = m.get(r.tipo) ?? { tipo: r.tipo, mapa: 0, mtr: 0, total: 0 };
      if (r.origen === "mapa") fila.mapa += 1;
      else fila.mtr += 1;
      fila.total += 1;
      m.set(r.tipo, fila);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [filteredReclamos]);

  const linea = useMemo<LineaDia[]>(() => {
    const m = new Map<string, number>();
    filteredReclamos.forEach((r) => {
      const fecha = r.fecha?.slice(0, 10) ?? "";
      m.set(fecha, (m.get(fecha) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredReclamos]);

  function setFiltro<K extends keyof FiltrosUnificados>(key: K, value: FiltrosUnificados[K]) {
    setFiltros((prev) => ({ ...prev, [key]: value }));
  }

  function clearFiltros() {
    setFiltros(FILTROS_UNIFICADOS_INICIALES);
  }

  const hasFilters =
    filtros.origen !== "todos" ||
    filtros.comuna != null ||
    Boolean(filtros.barrio) ||
    Boolean(filtros.tipo) ||
    filtros.subtipos.length > 0 ||
    Boolean(filtros.urgencia) ||
    Boolean(filtros.desde) ||
    Boolean(filtros.hasta);

  const exportToCSV = () => {
    const escapeCsvField = (field: any) => {
      const str = String(field ?? "");
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
      "ID", "Origen", "Tipo", "Subtipo", "Comuna", "Barrio", "Urgencia", "Estado",
      "Dirección", "Descripción", "Fecha de creación", "Latitud", "Longitud",
      "Contacto (Nombre)", "Contacto (DNI)", "Contacto (Teléfono)", "Contacto (Email)",
      "Fotos", "Cargado por (Nombre)", "Cargado por (Email)", "Cargado por (Teléfono)",
    ].map(escapeCsvField).join(";");

    // Absolutas: el CSV se abre fuera del navegador que lo generó.
    const origin = window.location.origin;

    const rows = filteredReclamos.map((r) => {
      const fotosUrls = r.archivos
        .map((a) => urlAbsolutaDeArchivo(r.origen, a, origin))
        .join(" | ");

      return [
        r.id,
        r.origen === "mapa" ? "Mapa" : "Mandame Tu Reclamo",
        r.tipo,
        r.subtipo ?? "",
        r.comuna ?? "",
        r.barrio ?? "",
        r.urgencia ?? "Sin dato",
        r.estado ?? "",
        r.direccion ?? "",
        r.descripcion ?? "",
        r.fecha,
        r.lat ?? "",
        r.lng ?? "",
        r.nombre_contacto ?? "",
        r.dni ?? "",
        r.telefono ?? "",
        r.email ?? "",
        fotosUrls,
        r.creador_nombre ?? "",
        r.creador_email ?? "",
        r.creador_telefono ?? "",
      ].map(escapeCsvField).join(";");
    });

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    link.setAttribute("href", url);
    link.setAttribute("download", `reclamos_caba_export_${stamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-0 flex-1 bg-black min-h-screen">
      {data.mtr_error && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-6 py-2 text-[10px] font-bold text-amber-400 uppercase tracking-widest">
          ⚠ No se pudieron cargar los reclamos de Mandame Tu Reclamo. Se muestran solo los cargados en el mapa.
        </div>
      )}

      {/* Filtros */}
      <div className="bg-black border-b border-card-border px-6 py-4 shadow-2xl z-10">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Origen */}
          <div>
            <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-1">Origen</label>
            <div className="flex rounded overflow-hidden border border-card-border">
              {ORIGENES.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setFiltro("origen", o.value)}
                  className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors ${
                    filtros.origen === o.value
                      ? "bg-indigo-600 text-white"
                      : "bg-transparent text-muted hover:text-white hover:bg-white/5"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <FilterSelect
            label="Comuna"
            value={String(filtros.comuna ?? "")}
            onChange={(v) => {
              setFiltros((prev) => ({ ...prev, comuna: v ? Number(v) : null, barrio: null }));
            }}
          >
            <option value="" className="bg-black text-white">Todas</option>
            {COMUNAS.map((c) => (
              <option key={c} value={c} className="bg-black text-white">Comuna {String(c).padStart(2, "0")}</option>
            ))}
          </FilterSelect>

          {filtros.comuna != null && (
            <FilterSelect label="Barrio" value={filtros.barrio ?? ""} onChange={(v) => setFiltro("barrio", v || null)}>
              <option value="" className="bg-black text-white">Todos los barrios</option>
              {barriosDisponibles.map((b) => (
                <option key={b} value={b} className="bg-black text-white">{b}</option>
              ))}
            </FilterSelect>
          )}

          <FilterSelect
            label="Tipo"
            value={filtros.tipo ?? ""}
            onChange={(v) => setFiltros((prev) => ({ ...prev, tipo: v || null, subtipos: [] }))}
          >
            <option value="" className="bg-black">Todos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.nombre} className="bg-black text-white">{t.nombre}</option>
            ))}
          </FilterSelect>

          <SubtipoMultiSelect
            opciones={subtiposDisponibles}
            seleccionados={filtros.subtipos}
            onChange={(subtipos) => setFiltro("subtipos", subtipos)}
          />

          <FilterSelect label="Urgencia" value={filtros.urgencia ?? ""} onChange={(v) => setFiltro("urgencia", v || null)}>
            <option value="" className="bg-black">Todas</option>
            {URGENCIAS.map((u) => <option key={u} value={u} className="bg-black">{u}</option>)}
            <option value={URGENCIA_SIN_DATO} className="bg-black">Sin dato</option>
          </FilterSelect>

          <div className="flex gap-2">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-1">Desde</label>
              <input type="date" value={filtros.desde ?? ""} onChange={(e) => setFiltro("desde", e.target.value || null)}
                className="lla-input px-3 py-1.5 text-[10px] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-1">Hasta</label>
              <input type="date" value={filtros.hasta ?? ""} onChange={(e) => setFiltro("hasta", e.target.value || null)}
                className="lla-input px-3 py-1.5 text-[10px] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4 sm:mt-0 flex-wrap">
            {hasFilters && (
              <button onClick={clearFiltros} className="text-[10px] text-muted hover:text-white uppercase font-bold tracking-widest border border-card-border px-3 py-1.5 rounded transition-colors">
                Limpiar filtros
              </button>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded font-black uppercase tracking-tighter">
                {totales.total} RECLAMOS
              </span>
              <span className="text-[10px] text-zinc-400 border border-card-border px-2 py-1.5 rounded font-bold uppercase tracking-tighter">
                Mapa {totales.mapa}
              </span>
              <span className="text-[10px] text-zinc-400 border border-card-border px-2 py-1.5 rounded font-bold uppercase tracking-tighter">
                MTR {totales.mtr}
              </span>
              {totales.sinGeo > 0 && (
                <span className="text-[10px] text-amber-400/80 border border-amber-500/20 px-2 py-1.5 rounded font-bold uppercase tracking-tighter">
                  Sin geo {totales.sinGeo}
                </span>
              )}
            </div>

            <button
              onClick={exportToCSV}
              className="lla-btn-primary px-4 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-md"
            >
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Polygon drawing controls */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t border-card-border/50">
          <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Filtro por zona:</span>
          {!drawingMode && !activePolygon && (
            <button
              onClick={() => { setDrawingMode(true); setDrawingPoints([]); }}
              className="text-[10px] font-black uppercase tracking-widest border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 px-3 py-1.5 rounded transition-colors"
            >
              ✏ Dibujar zona
            </button>
          )}
          {drawingMode && (
            <>
              <span className="text-[10px] text-indigo-300 font-bold">
                {drawingPoints.length === 0 ? "Hacé clic en el mapa para agregar puntos" : `${drawingPoints.length} punto${drawingPoints.length !== 1 ? "s" : ""} — seguí haciendo clic`}
              </span>
              <button
                onClick={() => {
                  if (drawingPoints.length > 2) {
                    setActivePolygon(drawingPoints);
                    setDrawingMode(false);
                    setDrawingPoints([]);
                  }
                }}
                disabled={drawingPoints.length < 3}
                className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded transition-colors ${
                  drawingPoints.length >= 3
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                }`}
              >
                Confirmar zona
              </button>
              <button
                onClick={() => { setDrawingMode(false); setDrawingPoints([]); }}
                className="text-[10px] font-bold text-muted hover:text-white uppercase tracking-widest border border-card-border px-3 py-1.5 rounded transition-colors"
              >
                Cancelar
              </button>
            </>
          )}
          {!drawingMode && activePolygon && (
            <>
              <span className="text-[10px] text-indigo-300 font-bold">Zona activa ({activePolygon.length} puntos)</span>
              <button
                onClick={() => { setDrawingMode(true); setDrawingPoints([]); setActivePolygon(null); }}
                className="text-[10px] font-black uppercase tracking-widest border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 px-3 py-1.5 rounded transition-colors"
              >
                Redibujar
              </button>
              <button
                onClick={() => setActivePolygon(null)}
                className="text-[10px] font-bold text-muted hover:text-red-400 uppercase tracking-widest border border-card-border px-3 py-1.5 rounded transition-colors"
              >
                Quitar zona
              </button>
            </>
          )}
        </div>
      </div>

      {/* Mapa */}
      <div className="relative border-b border-card-border h-[450px]">
        <MapaLeaflet
          reclamos={filteredReclamos}
          drawingMode={drawingMode}
          drawingPoints={drawingPoints}
          activePolygon={activePolygon}
          onAddPoint={(lat, lng) => setDrawingPoints(prev => [...prev, [lat, lng]])}
        />
        {drawingMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-black/80 border border-indigo-500/60 text-indigo-300 text-[11px] font-bold uppercase tracking-widest px-4 py-2 rounded-full shadow-xl pointer-events-none">
            Modo dibujo · Hacé clic para agregar puntos
          </div>
        )}
      </div>

      {/* Charts */}
      <div className="bg-black px-6 py-8">
        <h2 className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-8 text-center">Analítica de Gestión <span className="text-white">CABA</span></h2>
        <Charts barras={barras} linea={linea} />
      </div>

    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="lla-input px-3 py-1.5 text-[10px] focus:outline-none appearance-none cursor-pointer pr-8"
      >
        {children}
      </select>
    </div>
  );
}
