// src/components/PublicPageClient.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ReclamoPublico, TipoReclamo, FiltrosPublicos, BarrasTipo, LineaDia } from "@/types";

import { fetchComunasGeoJSON, getComunaForPoint, fetchBarriosGeoJSON, getBarrioForPoint } from "@/lib/geofence";

const MapaLeaflet = dynamic(() => import("@/components/map/MapaLeaflet"), { ssr: false });
const Charts = dynamic(() => import("@/components/charts/Charts"), { ssr: false });

interface Props {
  initialReclamos: ReclamoPublico[];
  tipos: TipoReclamo[];
}

const URGENCIAS = ["BAJA", "MEDIA", "ALTA"];
const COMUNAS = Array.from({ length: 15 }, (_, i) => i + 1);

export default function PublicPageClient({ initialReclamos, tipos }: Props) {
  const [filtros, setFiltros] = useState<FiltrosPublicos>({});
  const [statsData, setStatsData] = useState<{ barras: BarrasTipo[]; linea: LineaDia[] } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [comunasGeo, setComunasGeo] = useState<any>(null);
  const [barriosGeo, setBarriosGeo] = useState<any>(null);

  useEffect(() => {
    fetchComunasGeoJSON().then(setComunasGeo);
    fetchBarriosGeoJSON().then(setBarriosGeo);
  }, []);

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
    return initialReclamos.filter((r) => {
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
      return true;
    });
  }, [initialReclamos, filtros, comunasGeo, barriosGeo]);

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

          <div className="flex items-center gap-4 mt-4 sm:mt-0">
            {hasFilters && (
              <button onClick={clearFiltros} className="text-[10px] text-muted hover:text-white uppercase font-bold tracking-widest border border-card-border px-3 py-1.5 rounded transition-colors">
                Limpiar
              </button>
            )}

            <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-3 py-1.5 rounded font-black uppercase tracking-tighter">
              {filteredReclamos.length} RECLAMOS ENCONTRADOS
            </span>
          </div>
        </div>
      </div>

      {/* Mapa */}
      <div className="h-[450px] relative border-b border-card-border">
        <MapaLeaflet reclamos={filteredReclamos} />
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
