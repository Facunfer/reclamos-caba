/**
 * Estados de reclamos y sugerencias: etiqueta, color y transiciones.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * Por qué esto vive en un archivo y no en cada componente
 * ─────────────────────────────────────────────────────────────────────────
 * Los dos vocabularios son parecidos pero NO iguales — un reclamo va
 * `nuevo → en_proceso → resuelto/descartado` y una sugerencia
 * `nuevo → en_evaluacion → aprobado/rechazado`— y comparten el valor `nuevo`.
 * Es la receta exacta para que dos copias diverjan: alguien agrega un estado a
 * reclamos, no lo agrega a sugerencias, y la mitad de la app muestra el valor
 * crudo de la base ("en_proceso", con guión bajo) en vez de la etiqueta.
 *
 * El Portal ya pasó por esto con los semáforos de interacciones y terminó
 * juntando labels y colores en un solo módulo; acá se arranca así de entrada.
 *
 * Los colores son los mismos tonos que ya usa `URGENCIA_COLORS`, para que las
 * dos escalas convivan en la misma tarjeta sin pelearse.
 */

import type { EstadoReclamo, EstadoSugerencia } from "@/types";

interface Estado<T extends string> {
  valor: T;
  label: string;
  clase: string;
}

export const ESTADOS_RECLAMO: Estado<EstadoReclamo>[] = [
  { valor: "nuevo", label: "Nuevo", clase: "bg-sky-950/40 text-sky-400 border border-sky-900/40" },
  { valor: "en_proceso", label: "En proceso", clase: "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40" },
  { valor: "resuelto", label: "Resuelto", clase: "bg-green-950/40 text-green-500 border border-green-900/40" },
  { valor: "descartado", label: "Descartado", clase: "bg-zinc-900/60 text-zinc-400 border border-zinc-700/40" },
];

export const ESTADOS_SUGERENCIA: Estado<EstadoSugerencia>[] = [
  { valor: "nuevo", label: "Nueva", clase: "bg-sky-950/40 text-sky-400 border border-sky-900/40" },
  { valor: "en_evaluacion", label: "En evaluación", clase: "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40" },
  { valor: "aprobado", label: "Aprobada", clase: "bg-green-950/40 text-green-500 border border-green-900/40" },
  { valor: "rechazado", label: "Rechazada", clase: "bg-zinc-900/60 text-zinc-400 border border-zinc-700/40" },
];

/**
 * Etiqueta y color de un estado. El fallback devuelve el valor crudo en vez de
 * un "—": si algún día la base tiene un estado que la UI no conoce, mostrarlo
 * feo es mucho mejor que esconderlo — así alguien lo ve y lo agrega acá.
 */
export function estadoReclamo(valor: string | null | undefined) {
  return (
    ESTADOS_RECLAMO.find((e) => e.valor === valor) ?? {
      valor: (valor ?? "") as EstadoReclamo,
      label: valor ?? "—",
      clase: "bg-zinc-900/60 text-zinc-400 border border-zinc-700/40",
    }
  );
}

export function estadoSugerencia(valor: string | null | undefined) {
  return (
    ESTADOS_SUGERENCIA.find((e) => e.valor === valor) ?? {
      valor: (valor ?? "") as EstadoSugerencia,
      label: valor ?? "—",
      clase: "bg-zinc-900/60 text-zinc-400 border border-zinc-700/40",
    }
  );
}

/** Los mismos colores de urgencia que ya usaban las dos tablas. */
export const URGENCIA_COLORS: Record<string, string> = {
  ALTA: "bg-red-950/40 text-red-500 border border-red-900/40",
  MEDIA: "bg-yellow-950/40 text-yellow-500 border border-yellow-900/40",
  BAJA: "bg-green-950/40 text-green-500 border border-green-900/40",
};
