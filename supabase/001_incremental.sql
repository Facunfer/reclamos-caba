-- ============================================================
-- supabase/migrations/001_incremental.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- SOLO agrega lo que falta, NO recrea tablas existentes
-- ============================================================

-- ============================================================
-- 1. AJUSTES INCREMENTALES A reclamos
-- ============================================================

-- Columna urgencia (si no existe)
ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS urgencia TEXT NOT NULL DEFAULT 'MEDIA'
  CHECK (urgencia IN ('BAJA', 'MEDIA', 'ALTA'));

-- Columna updated_at (si no existe)
ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Columna direccion_normalizada (si no existe)
ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS direccion_normalizada TEXT;

-- Columna lat/lng (si no existen)
ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;

ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- Columna estado (si no existe)
ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'nuevo'
  CHECK (estado IN ('nuevo', 'en_proceso', 'resuelto', 'descartado'));

-- Columna creado_por_user_id (si no existe)
ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS creado_por_user_id UUID REFERENCES auth.users(id);

-- Columna created_at (si no existe)
ALTER TABLE public.reclamos
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_reclamos_comuna_id ON public.reclamos(comuna_id);
CREATE INDEX IF NOT EXISTS idx_reclamos_estado ON public.reclamos(estado);
CREATE INDEX IF NOT EXISTS idx_reclamos_urgencia ON public.reclamos(urgencia);
CREATE INDEX IF NOT EXISTS idx_reclamos_created_at ON public.reclamos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reclamos_tipo ON public.reclamos(tipo_reclamo);

-- Trigger para updated_at automático
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reclamos_set_updated_at ON public.reclamos;
CREATE TRIGGER reclamos_set_updated_at
  BEFORE UPDATE ON public.reclamos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 2. AJUSTES INCREMENTALES A perfiles
-- ============================================================

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS comuna_id INTEGER NOT NULL DEFAULT 1
  CHECK (comuna_id BETWEEN 1 AND 15);

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Índice único en user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_perfiles_user_id ON public.perfiles(user_id);

-- ============================================================
-- 3. VIEW reclamos_publicos (sin teléfono)
-- ============================================================

-- Eliminar si existe (puede ser tabla o view vieja)
DROP VIEW IF EXISTS public.reclamos_publicos CASCADE;
-- Si era tabla: DROP TABLE IF EXISTS public.reclamos_publicos; -- ejecutar este si la anterior falla

CREATE OR REPLACE VIEW public.reclamos_publicos AS
SELECT
  r.id,
  r.tipo_reclamo,
  r.urgencia,
  r.descripcion,
  r.nombre_contacto,
  -- Teléfono enmascarado: muestra sólo últimos 4 dígitos
  CASE
    WHEN r.telefono_contacto IS NOT NULL AND length(r.telefono_contacto) >= 4
    THEN regexp_replace(r.telefono_contacto, '.', '*', 1, length(r.telefono_contacto) - 4)
    ELSE '****'
  END AS telefono_contacto_mascara,
  r.direccion_raw,
  r.direccion_normalizada,
  r.lat,
  r.lng,
  r.estado,
  r.comuna_id,
  r.created_at
FROM public.reclamos r;

-- Grant SELECT público sobre la view (anon role)
GRANT SELECT ON public.reclamos_publicos TO anon;
GRANT SELECT ON public.reclamos_publicos TO authenticated;

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

ALTER TABLE public.reclamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. POLICIES: perfiles
-- ============================================================

DROP POLICY IF EXISTS "perfiles_select_own" ON public.perfiles;
CREATE POLICY "perfiles_select_own"
  ON public.perfiles FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE solo service role (seed). No client policy needed.

-- ============================================================
-- 6. POLICIES: reclamos
-- ============================================================

-- SELECT: solo misma comuna que el perfil del usuario
DROP POLICY IF EXISTS "reclamos_select_own_comuna" ON public.reclamos;
CREATE POLICY "reclamos_select_own_comuna"
  ON public.reclamos FOR SELECT
  TO authenticated
  USING (
    comuna_id = (
      SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()
    )
  );

-- INSERT: solo si creado_por_user_id = auth.uid() y comuna coincide
DROP POLICY IF EXISTS "reclamos_insert_own_comuna" ON public.reclamos;
CREATE POLICY "reclamos_insert_own_comuna"
  ON public.reclamos FOR INSERT
  TO authenticated
  WITH CHECK (
    creado_por_user_id = auth.uid()
    AND
    comuna_id = (
      SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()
    )
  );

-- UPDATE: solo misma comuna
DROP POLICY IF EXISTS "reclamos_update_own_comuna" ON public.reclamos;
CREATE POLICY "reclamos_update_own_comuna"
  ON public.reclamos FOR UPDATE
  TO authenticated
  USING (
    comuna_id = (
      SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()
    )
  );

-- DELETE: solo misma comuna
DROP POLICY IF EXISTS "reclamos_delete_own_comuna" ON public.reclamos;
CREATE POLICY "reclamos_delete_own_comuna"
  ON public.reclamos FOR DELETE
  TO authenticated
  USING (
    comuna_id = (
      SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. tipos_reclamo: solo grant read público (no modificar datos)
-- ============================================================

GRANT SELECT ON public.tipos_reclamo TO anon;
GRANT SELECT ON public.tipos_reclamo TO authenticated;

-- Opcional: enable RLS en tipos_reclamo con política pública
ALTER TABLE public.tipos_reclamo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tipos_reclamo_select_all" ON public.tipos_reclamo;
CREATE POLICY "tipos_reclamo_select_all"
  ON public.tipos_reclamo FOR SELECT
  USING (activo = true);
