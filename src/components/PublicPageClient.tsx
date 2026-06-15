// src/components/PublicPageClient.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ReclamoPublico, TipoReclamo, FiltrosPublicos, BarrasTipo, LineaDia, ContactoComuna } from "@/types";

import { fetchComunasGeoJSON, getComunaForPoint, fetchBarriosGeoJSON, getBarrioForPoint } from "@/lib/geofence";

const MapaLeaflet = dynamic(() => import("@/components/map/MapaLeaflet"), { ssr: false });
const Charts = dynamic(() => import("@/components/charts/Charts"), { ssr: false });

interface Props {
  initialReclamos: ReclamoPublico[];
  tipos: TipoReclamo[];
  contactosComunas?: ContactoComuna[];
}

const URGENCIAS = ["BAJA", "MEDIA", "ALTA"];
const COMUNAS = Array.from({ length: 15 }, (_, i) => i + 1);

function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lati, lngi] = polygon[i];
    const [latj, lngj] = polygon[j];
    const intersect = ((lngi > lng) !== (lngj > lng)) &&
      (lat < (latj - lati) * (lng - lngi) / (lngj - lngi) + lati);
    if (intersect) inside = !inside;
  }
  return inside;
}

export default function PublicPageClient({ initialReclamos, tipos, contactosComunas = [] }: Props) {
  const [filtros, setFiltros] = useState<FiltrosPublicos>({});
  const [statsData, setStatsData] = useState<{ barras: BarrasTipo[]; linea: LineaDia[] } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [barriosGeo, setBarriosGeo] = useState<any>(null);
  const [comunasGeo, setComunasGeo] = useState<any>(null);
  const [reclamosConArchivos, setReclamosConArchivos] = useState<ReclamoPublico[]>(initialReclamos);
  const [drawingMode, setDrawingMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const [activePolygon, setActivePolygon] = useState<[number, number][] | null>(null);

  useEffect(() => {
    fetchComunasGeoJSON().then(setComunasGeo);
    fetchBarriosGeoJSON().then(setBarriosGeo);

    // Fetch files for initial reclamos
    const fetchFiles = async () => {
      const ids = initialReclamos.map(r => r.id);
      if (ids.length === 0) return;

      console.log(`[PublicPage] Fetching files for ${ids.length} reclamos...`);

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: archivos, error } = await supabase
        .from("reclamo_archivos")
        .select("*")
        .in("reclamo_id", ids);

      if (error) {
        console.error("[PublicPage] Error fetching files:", error);
        return;
      }

      console.log(`[PublicPage] Found ${archivos?.length || 0} files.`);

      if (archivos) {
        setReclamosConArchivos(prev => prev.map(r => {
          const matchingArchivos = archivos.filter(a => a.reclamo_id === r.id);
          return {
            ...r,
            reclamo_archivos: matchingArchivos
          };
        }));
      }
    };
    fetchFiles();
  }, [initialReclamos]);

  // Compute neighborhoods available for the selected Comuna
  const availableBarrios = useMemo(() => {
    if (!filtros.comuna || !barriosGeo) return [];
    return barriosGeo.features
      .filter((f: any) => {
        const c = f.properties.comuna || f.properties.COMUNA;
        return Number(c) === Number(filtros.comuna);
      })
      .map((f: any) => f.properties.nombre || f.properties.BARRIO || f.properties.barrio || f.properties.NOMBRE)
      .sort();
  }, [filtros.comuna, barriosGeo]);

  // Client-side filter on initial data
  const filteredReclamos = useMemo(() => {
    return reclamosConArchivos.filter((r) => {
      // Filtro por comuna basado en Geofencing
      if (filtros.comuna) {
        if (!r.lat || !r.lng) return false;
        if (comunasGeo) {
          const comunaAsignada = getComunaForPoint({ lat: r.lat, lng: r.lng }, comunasGeo);
          if (comunaAsignada !== Number(filtros.comuna)) return false;
        } else {
          if (r.comuna_id !== Number(filtros.comuna)) return false;
        }
      }

      // Filtro por barrio basado en Geofencing
      if (filtros.barrio && r.lat && r.lng && barriosGeo) {
        const barrioAsignado = getBarrioForPoint({ lat: r.lat, lng: r.lng }, barriosGeo);
        if (barrioAsignado !== filtros.barrio) return false;
      }

      if (filtros.tipo && r.tipo_reclamo !== filtros.tipo) return false;
      if (filtros.urgencia && r.urgencia !== filtros.urgencia) return false;
      if (filtros.desde && r.created_at < filtros.desde) return false;
      if (filtros.hasta && r.created_at > filtros.hasta + "T23:59:59") return false;

      if (activePolygon && activePolygon.length > 2) {
        if (!r.lat || !r.lng) return false;
        if (!pointInPolygon(r.lat, r.lng, activePolygon)) return false;
      }

      return true;
    });
  }, [reclamosConArchivos, filtros, comunasGeo, barriosGeo, activePolygon]);

  // Aggregate locally for charts
  const barras = useMemo<BarrasTipo[]>(() => {
    const m = new Map<string, number>();
    filteredReclamos.forEach((r) => m.set(r.tipo_reclamo, (m.get(r.tipo_reclamo) ?? 0) + 1));
    return Array.from(m.entries())
      .map(([tipo_reclamo, total]) => ({ tipo_reclamo, total }))
      .sort((a, b) => b.total - a.total);
  }, [filteredReclamos]);

  const linea = useMemo<LineaDia[]>(() => {
    const m = new Map<string, number>();
    filteredReclamos.forEach((r) => {
      const fecha = r.created_at?.slice(0, 10) ?? "";
      m.set(fecha, (m.get(fecha) ?? 0) + 1);
    });
    return Array.from(m.entries())
      .map(([fecha, total]) => ({ fecha, total }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [filteredReclamos]);

  function setFiltro(key: keyof FiltrosPublicos, value: string | null) {
    setFiltros((prev) => ({ ...prev, [key]: value || null }));
  }

  function clearFiltros() {
    setFiltros({});
  }

  const hasFilters = Object.values(filtros).some(Boolean);

  const exportToCSV = () => {
    const escapeCsvField = (field: any) => {
      const str = String(field ?? "");
      return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = ["ID", "Tipo", "Comuna", "Urgencia", "Estado", "Dirección", "Descripción", "Fecha de creación", "Latitud", "Longitud", "Fotos", "Cargado por (Nombre)", "Cargado por (Email)", "Cargado por (Teléfono)", "Cargado por (Comuna)"]
      .map(escapeCsvField)
      .join(",");

    const rows = filteredReclamos.map(r => {
      const baseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
      const fotosUrls = (r.reclamo_archivos || [])
        .map(a => `${baseUrl}/storage/v1/object/public/reclamos-fotos/${a.storage_path}`)
        .join(" | ");

      return [
        r.id,
        r.tipo_reclamo,
        r.comuna_id,
        r.urgencia,
        r.estado,
        r.direccion_normalizada || r.direccion_raw,
        r.descripcion || "",
        r.created_at,
        r.lat,
        r.lng,
        fotosUrls,
        r.creador_nombre || "",
        r.creador_email || "",
        r.creador_telefono || "",
        r.comuna_id ? `Comuna ${String(r.comuna_id).padStart(2, "0")}` : "",
      ].map(escapeCsvField).join(",");
    });

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute("href", url);
    link.setAttribute("download", `reclamos_caba_export_${date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-0 flex-1 bg-black min-h-screen">
      {/* Filtros */}
      <div className="bg-black border-b border-card-border px-6 py-4 shadow-2xl z-10">
        <div className="flex flex-wrap gap-4 items-end">
          <FilterSelect label="Comuna" value={String(filtros.comuna ?? "")} onChange={(v) => {
            setFiltro("comuna", v || null);
            setFiltro("barrio", null); // Reset barrio when comuna changes
          }}>
            <option value="" className="bg-black text-white">Todas</option>
            {COMUNAS.map((c) => (
              <option key={c} value={c} className="bg-black text-white">Comuna {String(c).padStart(2, "0")}</option>
            ))}
          </FilterSelect>

          {filtros.comuna && (
            <FilterSelect label="Barrio" value={filtros.barrio ?? ""} onChange={(v) => setFiltro("barrio", v)}>
              <option value="" className="bg-black text-white">Todos los barrios</option>
              {availableBarrios.map((b) => (
                <option key={b} value={b} className="bg-black text-white">{b}</option>
              ))}
            </FilterSelect>
          )}

          <FilterSelect label="Tipo" value={filtros.tipo ?? ""} onChange={(v) => setFiltro("tipo", v)}>
            <option value="" className="bg-black">Todos</option>
            {tipos.map((t) => (
              <option key={t.id} value={t.nombre} className="bg-black text-white">{t.nombre}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Urgencia" value={filtros.urgencia ?? ""} onChange={(v) => setFiltro("urgencia", v)}>
            <option value="" className="bg-black">Todas</option>
            {URGENCIAS.map((u) => <option key={u} value={u} className="bg-black">{u}</option>)}
          </FilterSelect>

          <div className="flex gap-2">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-1">Desde</label>
              <input type="date" value={filtros.desde ?? ""} onChange={(e) => setFiltro("desde", e.target.value)}
                className="lla-input px-3 py-1.5 text-[10px] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase tracking-widest mb-1 ml-1">Hasta</label>
              <input type="date" value={filtros.hasta ?? ""} onChange={(e) => setFiltro("hasta", e.target.value)}
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

            <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded font-black uppercase tracking-tighter">
              {filteredReclamos.length} RECLAMOS ENCONTRADOS
            </span>

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
