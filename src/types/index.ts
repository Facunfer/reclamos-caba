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
  subtipo: string | null;
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

// ---------- Integración "Mandame Tu Reclamo" (MTR) ----------

export type OrigenReclamo = "mapa" | "mtr";

// Shape unificado que consume /public: mezcla reclamos nativos (origen
// "mapa") con los de MTR (origen "mtr"). Ver src/app/api/public/reclamos.
export interface ReclamoUnificado {
  id: string; // "mapa:<uuid>" | "mtr:<uuid>", evita colisiones entre fuentes
  origen: OrigenReclamo;
  tipo: string; // taxonomía unificada, ver src/lib/taxonomia.ts
  subtipo: string | null;
  urgencia: Urgencia | null; // null para MTR (no tiene ese campo)
  estado: string | null; // vocabulario distinto por origen, sin normalizar
  descripcion: string | null;
  direccion: string | null;
  lat: number | null;
  lng: number | null;
  comuna: number | null; // derivada por point-in-polygon, no la cargada a mano
  barrio: string | null; // ídem
  fecha: string; // ISO
  nombre_contacto: string | null;
  dni: string | null; // solo MTR; null para nativos
  telefono: string | null; // completo, sin enmascarar (decisión explícita)
  email: string | null; // solo MTR; null para nativos
  // Datos del empleado comunal que cargó el reclamo (solo origen "mapa")
  creador_nombre: string | null;
  creador_email: string | null;
  creador_telefono: string | null;
  // Adjuntos. Solo origen "mapa": el bucket de MTR es privado y requeriría
  // URLs firmadas server-side (pendiente, ver docs/DEPLOY-MTR.md).
  archivos: ReclamoArchivo[];
  sin_geo: boolean;
}

export interface ReclamosUnificadosResponse {
  reclamos: ReclamoUnificado[];
  mtr_error: boolean;
  total_mapa: number;
  total_mtr: number;
}

export type FiltroOrigen = "todos" | "mapa" | "mtr";

// "SIN_DATO" es una opción explícita del filtro de urgencia: los reclamos de
// MTR no tienen ese campo y no deben desaparecer silenciosamente.
export const URGENCIA_SIN_DATO = "SIN_DATO";

export interface FiltrosUnificados {
  origen: FiltroOrigen;
  comuna: number | null;
  barrio: string | null;
  tipo: string | null;
  subtipos: string[]; // selección múltiple; vacío = todos
  urgencia: string | null; // Urgencia | "SIN_DATO" | null
  desde: string | null;
  hasta: string | null;
}

export const FILTROS_UNIFICADOS_INICIALES: FiltrosUnificados = {
  origen: "todos",
  comuna: null,
  barrio: null,
  tipo: null,
  subtipos: [],
  urgencia: null,
  desde: null,
  hasta: null,
};

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

// Barras del dashboard unificado: apiladas por origen. El tipo lo carga la
// etiqueta del eje X, no el color — el color codifica el origen (2 series).
export interface BarrasTipoApilada {
  tipo: string;
  mapa: number;
  mtr: number;
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
