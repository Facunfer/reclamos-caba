// src/types/index.ts

export type Urgencia = "BAJA" | "MEDIA" | "ALTA";
export type EstadoReclamo = "nuevo" | "en_proceso" | "resuelto" | "descartado";

export interface TipoReclamo {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Perfil {
  id: string;
  user_id: string;
  comuna_id: number;
  created_at: string;
}

export interface Reclamo {
  id: string;
  tipo_reclamo: string;
  urgencia: Urgencia;
  descripcion: string;
  nombre_contacto: string;
  telefono_contacto: string;
  direccion_raw: string;
  direccion_normalizada: string | null;
  lat: number | null;
  lng: number | null;
  estado: EstadoReclamo;
  comuna_id: number;
  creado_por_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ReclamoPublico {
  id: string;
  tipo_reclamo: string;
  urgencia: Urgencia;
  descripcion: string;
  nombre_contacto: string;
  direccion_raw: string;
  direccion_normalizada: string | null;
  lat: number | null;
  lng: number | null;
  estado: EstadoReclamo;
  comuna_id: number;
  created_at: string;
}

export interface ReclamoConTipo extends Reclamo {
  tipos_reclamo?: { nombre: string };
}

export type EstadoSugerencia = "nuevo" | "en_evaluacion" | "aprobado" | "rechazado";

export interface TipoSugerencia {
  id: number;
  nombre: string;
  descripcion: string;
  activo: boolean;
}

export interface Sugerencia {
  id: string;
  tipo_sugerencia: string;
  urgencia: Urgencia;
  descripcion: string;
  nombre_contacto: string;
  telefono_contacto: string;
  direccion_raw: string;
  direccion_normalizada: string | null;
  lat: number | null;
  lng: number | null;
  estado: EstadoSugerencia;
  comuna_id: number;
  creado_por_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface SugerenciaPublica {
  id: string;
  tipo_sugerencia: string;
  urgencia: Urgencia;
  descripcion: string;
  nombre_contacto: string;
  direccion_raw: string;
  direccion_normalizada: string | null;
  lat: number | null;
  lng: number | null;
  estado: EstadoSugerencia;
  comuna_id: number;
  created_at: string;
}

// Aggregated query result types
export interface BarrasTipo {
  tipo_reclamo: string;
  total: number;
}

export interface LineaDia {
  fecha: string;
  total: number;
}

export interface FiltrosPublicos {
  comuna?: number | null;
  barrio?: string | null;
  tipo?: string | null;
  urgencia?: Urgencia | null;
  estado?: EstadoReclamo | null;
  desde?: string | null;
  hasta?: string | null;
}

export interface FiltrosSugerenciasPublicas {
  comuna?: number | null;
  barrio?: string | null;
  tipo?: string | null;
  urgencia?: Urgencia | null;
  estado?: EstadoSugerencia | null;
  desde?: string | null;
  hasta?: string | null;
}
