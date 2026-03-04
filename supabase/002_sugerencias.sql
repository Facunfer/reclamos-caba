-- ============================================================
-- supabase/migrations/002_sugerencias.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Crea las tablas y vistas para Sugerencias, paralelas a Reclamos
-- ============================================================

-- ============================================================
-- 1. TABLA: tipos_sugerencia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tipos_sugerencia (
    id SERIAL PRIMARY KEY,
    nombre TEXT NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true
);

-- Insertar algunos tipos por defecto
INSERT INTO public.tipos_sugerencia (nombre, descripcion) VALUES
    ('Espacio Público', 'Mejoras en plazas, parques y veredas'),
    ('Tránsito y Transporte', 'Ideas para mejorar la movilidad y el transporte público'),
    ('Medio Ambiente', 'Propuestas sobre reciclaje, limpieza y ecología'),
    ('Seguridad', 'Sugerencias relacionadas a la seguridad pública'),
    ('Cultura y Deportes', 'Actividades culturales, deportivas y recreativas'),
    ('Otros', 'Sugerencias generales')
ON CONFLICT (nombre) DO NOTHING;

-- Grant SELECT
GRANT SELECT ON public.tipos_sugerencia TO anon;
GRANT SELECT ON public.tipos_sugerencia TO authenticated;

-- RLS
ALTER TABLE public.tipos_sugerencia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipos_sugerencia_select_all" ON public.tipos_sugerencia FOR SELECT USING (activo = true);

-- ============================================================
-- 2. TABLA: sugerencias
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sugerencias (
    id SERIAL PRIMARY KEY,
    tipo_sugerencia TEXT NOT NULL REFERENCES public.tipos_sugerencia(nombre) ON UPDATE CASCADE,
    urgencia TEXT NOT NULL DEFAULT 'MEDIA' CHECK (urgencia IN ('BAJA', 'MEDIA', 'ALTA')),
    descripcion TEXT NOT NULL,
    nombre_contacto TEXT,
    telefono_contacto TEXT,
    direccion_raw TEXT NOT NULL,
    direccion_normalizada TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'en_evaluacion', 'aprobado', 'rechazado')),
    comuna_id INTEGER NOT NULL CHECK (comuna_id BETWEEN 1 AND 15),
    creado_por_user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_sugerencias_comuna_id ON public.sugerencias(comuna_id);
CREATE INDEX IF NOT EXISTS idx_sugerencias_estado ON public.sugerencias(estado);
CREATE INDEX IF NOT EXISTS idx_sugerencias_created_at ON public.sugerencias(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sugerencias_tipo ON public.sugerencias(tipo_sugerencia);

-- Trigger updated_at
CREATE TRIGGER sugerencias_set_updated_at
    BEFORE UPDATE ON public.sugerencias
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 3. VIEW: sugerencias_publicas
-- ============================================================
CREATE OR REPLACE VIEW public.sugerencias_publicas AS
SELECT
    s.id,
    s.tipo_sugerencia,
    s.urgencia,
    s.descripcion,
    s.nombre_contacto,
    CASE
        WHEN s.telefono_contacto IS NOT NULL AND length(s.telefono_contacto) >= 4
        THEN regexp_replace(s.telefono_contacto, '.', '*', 1, length(s.telefono_contacto) - 4)
        ELSE '****'
    END AS telefono_contacto_mascara,
    s.direccion_raw,
    s.direccion_normalizada,
    s.lat,
    s.lng,
    s.estado,
    s.comuna_id,
    s.created_at
FROM public.sugerencias s;

GRANT SELECT ON public.sugerencias_publicas TO anon;
GRANT SELECT ON public.sugerencias_publicas TO authenticated;

-- ============================================================
-- 4. RLS para sugerencias
-- ============================================================
ALTER TABLE public.sugerencias ENABLE ROW LEVEL SECURITY;

-- SELECT
CREATE POLICY "sugerencias_select_own_comuna"
    ON public.sugerencias FOR SELECT TO authenticated
    USING (comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()));

-- INSERT
CREATE POLICY "sugerencias_insert_own_comuna"
    ON public.sugerencias FOR INSERT TO authenticated
    WITH CHECK (creado_por_user_id = auth.uid() AND comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()));

-- UPDATE
CREATE POLICY "sugerencias_update_own_comuna"
    ON public.sugerencias FOR UPDATE TO authenticated
    USING (comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()));

-- DELETE
CREATE POLICY "sugerencias_delete_own_comuna"
    ON public.sugerencias FOR DELETE TO authenticated
    USING (comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()));
