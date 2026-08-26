// Paleta categórica de los 14 tipos unificados + los 2 orígenes.
// Fuente única: la usan el mapa, la leyenda y los gráficos. No hardcodear
// colores en los componentes.
//
// ── Cómo se construyó y qué garantiza ────────────────────────────────────
// Reemplaza al hash `stringToColor` anterior, que generaba tonos sin ningún
// control de separación. Estos 14 tonos se generaron equiespaciados en OKLCH
// sobre la superficie negra del dashboard (#000000), alternando luminosidad
// dentro de la banda dark (L 0.48–0.67), y el ORDEN de los slots se optimizó
// por hill climbing para maximizar el mínimo ΔE entre pares contiguos.
//
// Medido con el validador de la metodología de dataviz (OKLab ΔE ×100,
// simulación Machado-Oliveira-Fernandes 2009 severidad 1.0):
//
//   Pares ADYACENTES (leyenda, barras apiladas) — TODOS PASAN
//     · banda de luminosidad ....... 14/14 dentro de L 0.48–0.67
//     · piso de croma .............. 14/14 >= 0.10
//     · separación CVD ............. peor par ΔE 11.3 (>= 8 objetivo)
//     · piso de visión normal ...... peor par ΔE 16.9 (>= 15 piso)
//     · contraste vs superficie .... 14/14 >= 3:1
//
//   TODOS los pares (caso mapa: cualquier par de puntos puede quedar
//   contiguo) — FALLA, y es inevitable con 14 categorías:
//     · CVD .......... peor par ΔE 1.1 (#9e6e1d ↔ #5c792b bajo protanopía)
//     · visión normal  peor par ΔE 6.0 (#34639f ↔ #07779e)
//
// Es decir: en el mapa hay pares de tipos que un lector no puede distinguir
// solo por color (y varios más para personas con daltonismo). Decisión de
// producto tomada explícitamente: se prioriza mostrar los 14 tipos.
// MITIGACIÓN OBLIGATORIA — el color nunca es el único canal de identidad:
//   1. el popup de cada punto nombra tipo y subtipo en texto;
//   2. la leyenda del mapa lista las 14 categorías con su color;
//   3. el filtro de Tipo permite aislar una categoría.
// No quitar ninguna de las tres sin revisar esta decisión.
//
// El origen NO se codifica por color (el color ya lo gasta el tipo): va por
// un anillo/borde en el marcador, canal visual secundario.

import { TIPOS_UNIFICADOS, type TipoUnificado } from "@/lib/taxonomia";

// Orden de slots optimizado — NO reordenar sin volver a correr el validador.
const SLOTS = [
  "#b15d58", "#6e70b8", "#5c792b", "#07779e", "#9e6e1d", "#028d79", "#924c20",
  "#a0943c", "#34639f", "#227342", "#a480c7", "#924461", "#12a5b1", "#925389",
] as const;

const COLOR_FALLBACK = "#6b7280"; // gris neutro para un tipo no catalogado

// Asignación FIJA tipo -> color. El color sigue a la entidad, nunca a su
// posición en un ranking: filtrar no puede repintar a los que quedan.
const COLOR_POR_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_UNIFICADOS.map((tipo, i) => [tipo, SLOTS[i] ?? COLOR_FALLBACK])
);

export function colorDeTipo(tipo: string): string {
  return COLOR_POR_TIPO[tipo] ?? COLOR_FALLBACK;
}

export function leyendaTipos(): { tipo: TipoUnificado; color: string }[] {
  return TIPOS_UNIFICADOS.map((tipo) => ({ tipo, color: colorDeTipo(tipo) }));
}

// ── Origen ────────────────────────────────────────────────────────────────
// En los gráficos apilados el origen SÍ es la dimensión de identidad (2
// series), así que ahí toma color propio: dos slots bien separados.
// Medido sobre #000000 (all-pairs): CVD ΔE 26.8, visión normal ΔE 31.8 — holgado.
export const COLOR_ORIGEN = {
  mapa: "#3987e5",
  mtr: "#d95926",
} as const;

export const LABEL_ORIGEN = {
  mapa: "Cargados en el mapa",
  mtr: "Mandame Tu Reclamo",
} as const;
