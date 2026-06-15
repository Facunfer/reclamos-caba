-- ============================================================
-- supabase/006_circuitos.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor (DESPUÉS de 005)
--
-- Feature: problemas por circuito electoral de CABA.
--   - circuitos: polígonos oficiales de circuitos (geografía, lectura pública)
--   - tipos_problema_circuito: catálogo de tipos (lectura pública de activos)
--   - problemas_circuito: problemas cargados por cada comuna (RLS por comuna)
--   - problemas_circuito_publicos: vista saneada para el dashboard master
--
-- Patrón de RLS idéntico a reclamos/sugerencias.
-- Geometría con PostGIS (geometry(MultiPolygon,4326)).
-- ============================================================

-- 0. PostGIS ---------------------------------------------------
CREATE EXTENSION IF NOT EXISTS postgis;

-- En Supabase PostGIS suele instalarse en el schema `extensions`. Aseguramos que
-- el tipo `geometry` y las funciones ST_* se resuelvan durante esta migración.
SET search_path = public, extensions;

-- ============================================================
-- 1. TABLA: circuitos (geografía oficial)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.circuitos (
  id         SERIAL PRIMARY KEY,
  codigo     TEXT NOT NULL UNIQUE,                 -- id_circuit oficial (como texto)
  barrio     TEXT,                                 -- barrio del GeoJSON oficial
  comuna_id  INTEGER NOT NULL CHECK (comuna_id BETWEEN 1 AND 15),
  geom       geometry(MultiPolygon, 4326) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Nota: el GeoJSON oficial trae 'id_circuit', 'id_comuna' y 'barrio'.
-- No incluye 'seccion' ni un 'nombre' adicional, por eso no se crean esas columnas.

CREATE INDEX IF NOT EXISTS idx_circuitos_geom      ON public.circuitos USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_circuitos_comuna_id ON public.circuitos (comuna_id);
-- 'codigo' ya tiene índice único por la constraint UNIQUE.

-- ============================================================
-- 2. CATÁLOGO: tipos_problema_circuito
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tipos_problema_circuito (
  id     SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO public.tipos_problema_circuito (nombre) VALUES
  ('Infraestructura'),
  ('Seguridad'),
  ('Servicios'),
  ('Quejas vecinales'),
  ('Logística electoral'),
  ('Otros')
ON CONFLICT (nombre) DO NOTHING;

-- ============================================================
-- 3. TABLA: problemas_circuito
-- ============================================================
CREATE TABLE IF NOT EXISTS public.problemas_circuito (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circuito_id        INTEGER NOT NULL REFERENCES public.circuitos(id) ON DELETE CASCADE,
  comuna_id          INTEGER NOT NULL CHECK (comuna_id BETWEEN 1 AND 15), -- denormalizado para RLS
  tipo               TEXT NOT NULL REFERENCES public.tipos_problema_circuito(nombre) ON UPDATE CASCADE,
  urgencia           TEXT NOT NULL DEFAULT 'MEDIA' CHECK (urgencia IN ('BAJA','MEDIA','ALTA')),
  descripcion        TEXT NOT NULL,
  estado             TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo','en_proceso','resuelto','descartado')),
  lat                DOUBLE PRECISION,
  lng                DOUBLE PRECISION,
  creado_por_user_id UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_problemas_circuito_comuna_id  ON public.problemas_circuito (comuna_id);
CREATE INDEX IF NOT EXISTS idx_problemas_circuito_circuito_id ON public.problemas_circuito (circuito_id);
CREATE INDEX IF NOT EXISTS idx_problemas_circuito_estado     ON public.problemas_circuito (estado);
CREATE INDEX IF NOT EXISTS idx_problemas_circuito_created_at ON public.problemas_circuito (created_at DESC);

-- Trigger updated_at (reusa la función creada en 001)
DROP TRIGGER IF EXISTS problemas_circuito_set_updated_at ON public.problemas_circuito;
CREATE TRIGGER problemas_circuito_set_updated_at
  BEFORE UPDATE ON public.problemas_circuito
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. VISTA SANEADA: problemas_circuito_publicos
--    (sin datos de contacto; este modelo no los tiene, pero se
--     mantiene el patrón: el master consume la vista, no la tabla)
-- ============================================================
CREATE OR REPLACE VIEW public.problemas_circuito_publicos AS
SELECT
  p.id,
  p.circuito_id,
  p.comuna_id,
  p.tipo,
  p.urgencia,
  p.descripcion,
  p.estado,
  p.lat,
  p.lng,
  p.created_at
FROM public.problemas_circuito p;

GRANT SELECT ON public.problemas_circuito_publicos TO anon, authenticated;

-- ============================================================
-- 5. RLS
-- ============================================================

-- 5.1 circuitos: lectura pública (geografía oficial), sin escritura por cliente
ALTER TABLE public.circuitos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.circuitos TO anon, authenticated;
DROP POLICY IF EXISTS "circuitos_select_all" ON public.circuitos;
CREATE POLICY "circuitos_select_all"
  ON public.circuitos FOR SELECT USING (true);
-- INSERT/UPDATE/DELETE: solo service role (script de importación). Sin policies de cliente.

-- 5.2 tipos_problema_circuito: lectura pública de activos
ALTER TABLE public.tipos_problema_circuito ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.tipos_problema_circuito TO anon, authenticated;
DROP POLICY IF EXISTS "tipos_problema_circuito_select_all" ON public.tipos_problema_circuito;
CREATE POLICY "tipos_problema_circuito_select_all"
  ON public.tipos_problema_circuito FOR SELECT USING (activo = true);

-- 5.3 problemas_circuito: mismo patrón que reclamos/sugerencias
ALTER TABLE public.problemas_circuito ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "problemas_circuito_select_own_comuna" ON public.problemas_circuito;
CREATE POLICY "problemas_circuito_select_own_comuna"
  ON public.problemas_circuito FOR SELECT TO authenticated
  USING (comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "problemas_circuito_insert_own_comuna" ON public.problemas_circuito;
CREATE POLICY "problemas_circuito_insert_own_comuna"
  ON public.problemas_circuito FOR INSERT TO authenticated
  WITH CHECK (
    creado_por_user_id = auth.uid()
    AND comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "problemas_circuito_update_own_comuna" ON public.problemas_circuito;
CREATE POLICY "problemas_circuito_update_own_comuna"
  ON public.problemas_circuito FOR UPDATE TO authenticated
  USING (comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()));

DROP POLICY IF EXISTS "problemas_circuito_delete_own_comuna" ON public.problemas_circuito;
CREATE POLICY "problemas_circuito_delete_own_comuna"
  ON public.problemas_circuito FOR DELETE TO authenticated
  USING (comuna_id = (SELECT p.comuna_id FROM public.perfiles p WHERE p.user_id = auth.uid()));

-- El master ve todo a través de la vista pública problemas_circuito_publicos
-- (igual que con reclamos), NO por bypass de RLS.

-- ============================================================
-- 6. RPC: import_circuito (usada por scripts/seed-circuitos.ts)
--    Convierte GeoJSON → geometry(MultiPolygon,4326). Upsert por codigo.
--    Solo ejecutable por service_role (el script corre con service key).
-- ============================================================
CREATE OR REPLACE FUNCTION public.import_circuito(
  p_codigo    TEXT,
  p_barrio    TEXT,
  p_comuna_id INTEGER,
  p_geojson   JSONB
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.circuitos (codigo, barrio, comuna_id, geom)
  VALUES (
    p_codigo,
    p_barrio,
    p_comuna_id,
    ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(p_geojson::text), 4326))
  )
  ON CONFLICT (codigo) DO UPDATE
    SET barrio    = EXCLUDED.barrio,
        comuna_id = EXCLUDED.comuna_id,
        geom      = EXCLUDED.geom;
END;
$$;

REVOKE ALL ON FUNCTION public.import_circuito(TEXT, TEXT, INTEGER, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.import_circuito(TEXT, TEXT, INTEGER, JSONB) TO service_role;

-- ============================================================
-- 7. RPC: circuitos_featurecollection
--    Devuelve un FeatureCollection GeoJSON (opcionalmente filtrado por comuna).
--    Lectura pública (geografía no sensible).
-- ============================================================
CREATE OR REPLACE FUNCTION public.circuitos_featurecollection(
  p_comuna_id INTEGER DEFAULT NULL
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'type', 'FeatureCollection',
    'features', COALESCE(jsonb_agg(
      jsonb_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(c.geom)::jsonb,
        'properties', jsonb_build_object(
          'id', c.id,
          'codigo', c.codigo,
          'comuna_id', c.comuna_id,
          'barrio', c.barrio
        )
      )
    ), '[]'::jsonb)
  )
  FROM public.circuitos c
  WHERE p_comuna_id IS NULL OR c.comuna_id = p_comuna_id;
$$;

GRANT EXECUTE ON FUNCTION public.circuitos_featurecollection(INTEGER) TO anon, authenticated, service_role;

-- ============================================================
-- 8. Refrescar schema cache de PostgREST
-- ============================================================
NOTIFY pgrst, 'reload schema';
