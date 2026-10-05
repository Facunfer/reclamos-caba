-- 012_archivos_select_policy.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor (proyecto "reclamos")
--
-- Problema: reclamo_archivos tenia solo la policy de INSERT. Sin policy de
-- SELECT, RLS devuelve 0 filas a los usuarios de comuna, asi que el panel
-- nunca mostraba las fotos aunque estuvieran subidas (467 archivos en 290
-- reclamos al 2026-10-05).
--
-- Solucion: un usuario autenticado ve los archivos de los reclamos (o
-- sugerencias) que YA puede ver. El EXISTS consulta la tabla padre con sus
-- propias policies, asi que hereda "solo mi comuna" sin repetir la logica.
-- No se abre a anon: /public lee con service_role y no pasa por RLS.
-- Idempotente.

DROP POLICY IF EXISTS "reclamo_archivos_select_own_comuna" ON public.reclamo_archivos;

CREATE POLICY "reclamo_archivos_select_own_comuna"
ON public.reclamo_archivos FOR SELECT TO authenticated
USING (
  (reclamo_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.reclamos r WHERE r.id = reclamo_archivos.reclamo_id))
  OR
  (sugerencia_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sugerencias s WHERE s.id = reclamo_archivos.sugerencia_id))
);
