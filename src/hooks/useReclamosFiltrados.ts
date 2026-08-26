"use client";

import { useMemo } from "react";
import type { FiltrosUnificados, ReclamoUnificado } from "@/types";
import { URGENCIA_SIN_DATO } from "@/types";

/**
 * Ray-casting sobre un polígono dibujado a mano en el mapa.
 * El polígono viene como [lat, lng][] (orden de Leaflet).
 */
function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [lati, lngi] = polygon[i];
    const [latj, lngj] = polygon[j];
    const intersect =
      lngi > lng !== lngj > lng && lat < ((latj - lati) * (lng - lngi)) / (lngj - lngi) + lati;
    if (intersect) inside = !inside;
  }
  return inside;
}

export interface OpcionSubtipo {
  tipo: string;
  subtipo: string;
  total: number;
}

export interface ResultadoFiltrado {
  /** Dataset filtrado. Única fuente para mapa, gráficos, contadores y CSV. */
  reclamos: ReclamoUnificado[];
  /** Barrios presentes en el dataset para la comuna elegida (para el dropdown). */
  barriosDisponibles: string[];
  /** Subtipos disponibles, acotados al filtro de tipo activo, agrupados por tipo. */
  subtiposDisponibles: OpcionSubtipo[];
  /** Contadores del dataset filtrado. */
  totales: { total: number; mapa: number; mtr: number; sinGeo: number };
}

/**
 * Centraliza TODO el filtrado del dashboard público. Mapa, gráficos,
 * contadores y export CSV consumen de acá — no duplicar esta lógica.
 *
 * `comuna` y `barrio` ya vienen derivados server-side por point-in-polygon
 * (ver src/lib/reclamosUnificados.ts), así que acá se comparan directo.
 */
export function useReclamosFiltrados(
  reclamos: ReclamoUnificado[],
  filtros: FiltrosUnificados,
  activePolygon: [number, number][] | null
): ResultadoFiltrado {
  // Filtros que NO son el de barrio ni el de subtipo: se usan como base para
  // calcular las opciones disponibles de esos dos dropdowns.
  const base = useMemo(() => {
    return reclamos.filter((r) => {
      if (filtros.origen !== "todos" && r.origen !== filtros.origen) return false;
      if (filtros.comuna != null && r.comuna !== filtros.comuna) return false;

      if (filtros.urgencia) {
        if (filtros.urgencia === URGENCIA_SIN_DATO) {
          if (r.urgencia != null) return false;
        } else if (r.urgencia !== filtros.urgencia) return false;
      }

      if (filtros.desde && r.fecha < filtros.desde) return false;
      if (filtros.hasta && r.fecha > filtros.hasta + "T23:59:59") return false;

      if (activePolygon && activePolygon.length > 2) {
        if (r.lat == null || r.lng == null) return false;
        if (!pointInPolygon(r.lat, r.lng, activePolygon)) return false;
      }

      return true;
    });
  }, [reclamos, filtros.origen, filtros.comuna, filtros.urgencia, filtros.desde, filtros.hasta, activePolygon]);

  const barriosDisponibles = useMemo(() => {
    if (filtros.comuna == null) return [];
    const set = new Set<string>();
    for (const r of base) if (r.barrio) set.add(r.barrio);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [base, filtros.comuna]);

  const subtiposDisponibles = useMemo(() => {
    const conteo = new Map<string, OpcionSubtipo>();
    for (const r of base) {
      if (!r.subtipo) continue;
      if (filtros.tipo && r.tipo !== filtros.tipo) continue;
      const clave = `${r.tipo}||${r.subtipo}`;
      const actual = conteo.get(clave);
      if (actual) actual.total += 1;
      else conteo.set(clave, { tipo: r.tipo, subtipo: r.subtipo, total: 1 });
    }
    return Array.from(conteo.values()).sort(
      (a, b) => a.tipo.localeCompare(b.tipo, "es") || a.subtipo.localeCompare(b.subtipo, "es")
    );
  }, [base, filtros.tipo]);

  const reclamosFiltrados = useMemo(() => {
    const subtiposActivos = new Set(filtros.subtipos);
    return base.filter((r) => {
      if (filtros.barrio && r.barrio !== filtros.barrio) return false;
      if (filtros.tipo && r.tipo !== filtros.tipo) return false;
      if (subtiposActivos.size > 0 && (!r.subtipo || !subtiposActivos.has(r.subtipo))) return false;
      return true;
    });
  }, [base, filtros.barrio, filtros.tipo, filtros.subtipos]);

  const totales = useMemo(() => {
    let mapa = 0;
    let mtr = 0;
    let sinGeo = 0;
    for (const r of reclamosFiltrados) {
      if (r.origen === "mapa") mapa += 1;
      else mtr += 1;
      if (r.sin_geo) sinGeo += 1;
    }
    return { total: reclamosFiltrados.length, mapa, mtr, sinGeo };
  }, [reclamosFiltrados]);

  return { reclamos: reclamosFiltrados, barriosDisponibles, subtiposDisponibles, totales };
}
