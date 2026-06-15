-- ============================================================
-- supabase/007_hardening.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor (DESPUÉS de 006)
-- Endurecimiento menor detectado por el linter de Supabase.
-- ============================================================

-- 1. circuitos_featurecollection: no necesita SECURITY DEFINER.
--    La tabla `circuitos` ya tiene GRANT SELECT a anon/authenticated y
--    policy USING(true), así que con SECURITY INVOKER funciona igual y
--    reduce la superficie (deja de correr con privilegios del owner).
CREATE OR REPLACE FUNCTION public.circuitos_featurecollection(p_comuna_id INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, extensions
AS $$
  SELECT jsonb_build_object(
    'type','FeatureCollection',
    'features', COALESCE(jsonb_agg(jsonb_build_object(
      'type','Feature',
      'geometry', ST_AsGeoJSON(c.geom)::jsonb,
      'properties', jsonb_build_object('id',c.id,'codigo',c.codigo,'comuna_id',c.comuna_id,'barrio',c.barrio)
    )), '[]'::jsonb)
  )
  FROM public.circuitos c
  WHERE p_comuna_id IS NULL OR c.comuna_id = p_comuna_id;
$$;
GRANT EXECUTE ON FUNCTION public.circuitos_featurecollection(INTEGER) TO anon, authenticated, service_role;

-- 2. set_updated_at: fijar search_path (lint function_search_path_mutable).
ALTER FUNCTION public.set_updated_at() SET search_path = '';

NOTIFY pgrst, 'reload schema';
