-- ============================================================
-- supabase/009_taxonomia_unificada_rollback.sql
-- Revierte 009_taxonomia_unificada.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Usa el subtipo (que guarda el tipo_reclamo original) para des-mergear
-- HIGIENE Y SANEAMIENTO de vuelta en BASURA / AGUA/CLOACAS.
-- No borra la columna subtipo por defecto (ver paso opcional al final).
-- ============================================================

BEGIN;

-- 1. Revierte tipo_reclamo a los valores originales, usando subtipo para
--    desambiguar los dos casos que se habían mergeado en HIGIENE Y SANEAMIENTO.
UPDATE public.reclamos
SET tipo_reclamo = CASE
  WHEN tipo_reclamo = 'ACERAS' AND subtipo = 'VEREDAS' THEN 'VEREDAS'
  WHEN tipo_reclamo = 'ARBOLES/PLAZAS/PARQUES' AND subtipo = 'ARBOLADO' THEN 'ARBOLADO'
  WHEN tipo_reclamo = 'CALLES' AND subtipo = 'BACHES' THEN 'BACHES'
  WHEN tipo_reclamo = 'HIGIENE Y SANEAMIENTO' AND subtipo = 'BASURA' THEN 'BASURA'
  WHEN tipo_reclamo = 'HIGIENE Y SANEAMIENTO' AND subtipo = 'AGUA/CLOACAS' THEN 'AGUA/CLOACAS'
  WHEN tipo_reclamo = 'SEMAFOROS Y TRANSPORTE' AND subtipo = 'TRANSPORTE' THEN 'TRANSPORTE'
  ELSE tipo_reclamo
END;

-- 2. Reactiva el catálogo viejo.
UPDATE public.tipos_reclamo
SET activo = true
WHERE nombre IN ('VEREDAS', 'ARBOLADO', 'BACHES', 'BASURA', 'AGUA/CLOACAS', 'TRANSPORTE');

-- 3. Desactiva (no borra) las categorías nuevas agregadas por la migración.
UPDATE public.tipos_reclamo
SET activo = false
WHERE nombre IN (
  'ACERAS', 'ARBOLES/PLAZAS/PARQUES', 'CALLES', 'DEFENSA AL CONSUMIDOR',
  'ESCUELAS', 'HABILITACIONES', 'HIGIENE Y SANEAMIENTO', 'OBRAS',
  'SEMAFOROS Y TRANSPORTE', 'VIA PUBLICA'
);

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Opcional — reversión completa (además del rollback de datos de arriba):
-- solo correr si además querés borrar la columna subtipo por completo.
-- ============================================================
-- ALTER TABLE public.reclamos DROP COLUMN IF EXISTS subtipo;
-- ALTER TABLE public.problemas_circuito DROP COLUMN IF EXISTS subtipo;
