// Fuente única de la taxonomía unificada (ver supabase/009_taxonomia_unificada.sql).
// Cualquier UI que necesite las 14 categorías, o mapear un `grupo` de MTR a
// un tipo unificado, tiene que usar este módulo — no hardcodear la lista.

export const TIPOS_UNIFICADOS = [
  "ACERAS",
  "ALUMBRADO",
  "ARBOLES/PLAZAS/PARQUES",
  "CALLES",
  "DEFENSA AL CONSUMIDOR",
  "ESCUELAS",
  "HABILITACIONES",
  "HIGIENE Y SANEAMIENTO",
  "OBRAS",
  "OTROS",
  "RUIDOS",
  "SEGURIDAD",
  "SEMAFOROS Y TRANSPORTE",
  "VIA PUBLICA",
] as const;

export type TipoUnificado = (typeof TIPOS_UNIFICADOS)[number];

// grupo de MTR (claims.grupo) -> tipo unificado.
// SEMAFOROS y TRANSITO son dos grupos separados en MTR; se unifican en uno
// solo acá (decisión tomada explícitamente al integrar MTR).
const MTR_GRUPO_A_TIPO: Record<string, TipoUnificado> = {
  ACERAS: "ACERAS",
  ALUMBRADO: "ALUMBRADO",
  "ARBOLES/PLAZAS/PARQUES": "ARBOLES/PLAZAS/PARQUES",
  CALLES: "CALLES",
  "DEFENSA AL CONSUMIDOR": "DEFENSA AL CONSUMIDOR",
  ESCUELAS: "ESCUELAS",
  HABILITACIONES: "HABILITACIONES",
  "HIGIENE Y SANEAMIENTO": "HIGIENE Y SANEAMIENTO",
  OBRAS: "OBRAS",
  SEGURIDAD: "SEGURIDAD",
  SEMAFOROS: "SEMAFOROS Y TRANSPORTE",
  TRANSITO: "SEMAFOROS Y TRANSPORTE",
  "VIA PUBLICA": "VIA PUBLICA",
};

/**
 * Mapea un `grupo` de MTR al tipo unificado. Si aparece un grupo nuevo que
 * no está en el mapeo (MTR agregó una categoría no contemplada), cae en
 * "OTROS" en vez de romper el feed público, pero deja un warning en logs
 * para que se note y se agregue al mapeo.
 */
export function mapMtrGrupoToTipo(grupo: string | null | undefined): TipoUnificado {
  if (!grupo) return "OTROS";
  const tipo = MTR_GRUPO_A_TIPO[grupo.trim().toUpperCase()];
  if (!tipo) {
    console.warn(`[taxonomia] grupo de MTR sin mapeo: "${grupo}" -> cae en OTROS`);
    return "OTROS";
  }
  return tipo;
}
