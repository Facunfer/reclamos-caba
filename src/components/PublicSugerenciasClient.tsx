// src/components/PublicSugerenciasClient.tsx
"use client";
import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import type { SugerenciaPublica, TipoSugerencia, FiltrosSugerenciasPublicas, BarrasTipo, LineaDia } from "@/types";

import { fetchComunasGeoJSON, getComunaForPoint, fetchBarriosGeoJSON, getBarrioForPoint } from "@/lib/geofence";

// Reusing the same map and chart components, passing sugerencias as reclamos prop for map compatibility
const MapaLeaflet = dynamic(() => import("@/components/map/MapaLeaflet"), { ssr: false });
const Charts = dynamic(() => import("@/components/charts/Charts"), { ssr: false });

interface Props {
    initialSugerencias: SugerenciaPublica[];
    tipos: TipoSugerencia[];
}

const URGENCIAS = ["BAJA", "MEDIA", "ALTA"];
const COMUNAS = Array.from({ length: 15 }, (_, i) => i + 1);

export default function PublicSugerenciasClient({ initialSugerencias, tipos }: Props) {
    const [filtros, setFiltros] = useState<FiltrosSugerenciasPublicas>({});
    const [comunasGeo, setComunasGeo] = useState<any>(null);
    const [barriosGeo, setBarriosGeo] = useState<any>(null);

    useEffect(() => {
        fetchComunasGeoJSON().then(setComunasGeo);
        fetchBarriosGeoJSON().then(setBarriosGeo);
    }, []);

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

    const filteredSugerencias = useMemo(() => {
        return initialSugerencias.filter((s) => {
            if (filtros.comuna) {
                if (!s.lat || !s.lng) return false;
                if (comunasGeo) {
                    const comunaAsignada = getComunaForPoint({ lat: s.lat, lng: s.lng }, comunasGeo);
                    if (comunaAsignada !== Number(filtros.comuna)) return false;
                } else {
                    if (s.comuna_id !== Number(filtros.comuna)) return false;
                }
            }

            if (filtros.barrio && s.lat && s.lng && barriosGeo) {
                const barrioAsignado = getBarrioForPoint({ lat: s.lat, lng: s.lng }, barriosGeo);
                if (barrioAsignado !== filtros.barrio) return false;
            }

            if (filtros.tipo && s.tipo_sugerencia !== filtros.tipo) return false;
            if (filtros.urgencia && s.urgencia !== filtros.urgencia) return false;
            if (filtros.desde && s.created_at < filtros.desde) return false;
            if (filtros.hasta && s.created_at > filtros.hasta + "T23:59:59") return false;
            return true;
        });
    }, [initialSugerencias, filtros, comunasGeo, barriosGeo]);

    const barras = useMemo<BarrasTipo[]>(() => {
        const m = new Map<string, number>();
        filteredSugerencias.forEach((s) => m.set(s.tipo_sugerencia, (m.get(s.tipo_sugerencia) ?? 0) + 1));
        return Array.from(m.entries())
            .map(([tipo_reclamo, total]) => ({ tipo_reclamo, total })) // Usando tipo_reclamo para compatibilidad con backend
            .sort((a, b) => b.total - a.total);
    }, [filteredSugerencias]);

    const linea = useMemo<LineaDia[]>(() => {
        const m = new Map<string, number>();
        filteredSugerencias.forEach((s) => {
            const fecha = s.created_at?.slice(0, 10) ?? "";
            m.set(fecha, (m.get(fecha) ?? 0) + 1);
        });
        return Array.from(m.entries())
            .map(([fecha, total]) => ({ fecha, total }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
    }, [filteredSugerencias]);

    function setFiltro(key: keyof FiltrosSugerenciasPublicas, value: string | null) {
        setFiltros((prev) => ({ ...prev, [key]: value || null }));
    }

    function clearFiltros() {
        setFiltros({});
    }

    const hasFilters = Object.values(filtros).some(Boolean);

    // Map needs reclamos structure (at least for lat/lng, and we can map tipo_sugerencia into tipo_reclamo for the map popup)
    const mapData: any[] = filteredSugerencias.map(s => ({
        ...s,
        tipo_reclamo: s.tipo_sugerencia // For point colors/popups in MapaLeaflet
    }));

    return (
        <div className="flex flex-col gap-0 flex-1 bg-black min-h-screen">
            <div className="bg-black border-b border-card-border px-6 py-4 shadow-2xl z-10">
                <div className="flex flex-wrap gap-4 items-end">
                    <FilterSelect label="Comuna" value={String(filtros.comuna ?? "")} onChange={(v) => {
                        setFiltro("comuna", v || null);
                        setFiltro("barrio", null);
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

                    <FilterSelect label="Categoría" value={filtros.tipo ?? ""} onChange={(v) => setFiltro("tipo", v)}>
                        <option value="" className="bg-black">Todas</option>
                        {tipos.map((t) => (
                            <option key={t.id} value={t.nombre} className="bg-black text-white">{t.nombre}</option>
                        ))}
                    </FilterSelect>

                    <FilterSelect label="Importancia" value={filtros.urgencia ?? ""} onChange={(v) => setFiltro("urgencia", v)}>
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
                            {filteredSugerencias.length} SUGERENCIAS ENCONTRADAS
                        </span>
                    </div>
                </div>
            </div>

            {/* Mapa */}
            <div className="h-[450px] relative border-b border-card-border">
                <MapaLeaflet reclamos={mapData} />
            </div>

            {/* Charts */}
            <div className="bg-black px-6 py-8">
                <h2 className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-8 text-center">Analítica de Sugerencias <span className="text-white">CABA</span></h2>
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
