// src/types/index.ts

export interface ReclamoArchivo {
  id: string;
  tipo: 'foto' | 'pdf' | 'documento';
  storage_path: string;
  created_at: string;
}

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
  reclamo_archivos?: ReclamoArchivo[];
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
  creador_nombre: string | null;
  creador_email: string | null;
  creador_telefono: string | null;
  reclamo_archivos?: ReclamoArchivo[];
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
  reclamo_archivos?: ReclamoArchivo[];
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
  reclamo_archivos?: ReclamoArchivo[];
}

export interface ContactoComuna {
  comuna_id: number;
  email: string;
}

// ---------- Circuitos electorales ----------

export type EstadoProblemaCircuito = "nuevo" | "en_proceso" | "resuelto" | "descartado";

export interface TipoProblemaCircuito {
  id: number;
  nombre: string;
  activo: boolean;
}

export interface Circuito {
  id: number;
  codigo: string;
  barrio: string | null;
  comuna_id: number;
}

// Propiedades que viajan en cada Feature del FeatureCollection servido por la API
export interface CircuitoFeatureProps {
  id: number;
  codigo: string;
  comuna_id: number;
  barrio: string | null;
}

export interface ProblemaCircuito {
  id: string;
  circuito_id: number;
  comuna_id: number;
  tipo: string;
  urgencia: Urgencia;
  descripcion: string;
  estado: EstadoProblemaCircuito;
  lat: number | null;
  lng: number | null;
  creado_por_user_id: string;
  created_at: string;
  updated_at: string;
}

// Vista saneada que consume el dashboard master (sin datos de contacto)
export interface ProblemaCircuitoPublico {
  id: string;
  circuito_id: number;
  comuna_id: number;
  tipo: string;
  urgencia: Urgencia;
  descripcion: string;
  estado: EstadoProblemaCircuito;
  lat: number | null;
  lng: number | null;
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
