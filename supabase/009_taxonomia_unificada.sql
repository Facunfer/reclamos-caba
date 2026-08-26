-- ============================================================
-- supabase/009_taxonomia_unificada.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor (DESPUÉS de 008)
--
-- Unifica la taxonomía de tipos de reclamo entre este sistema y la fuente
-- externa "Mandame Tu Reclamo" (MTR). El modelo pasa a ser de dos niveles:
--   - tipo:    la categoría unificada (14 valores, catálogo tipos_reclamo)
--   - subtipo: el detalle original (texto libre, sin catálogo propio)
--
-- Lo que hoy es `tipo_reclamo` en las 177 filas existentes pasa a `subtipo`,
-- preservando el detalle original. Luego `tipo_reclamo` se reasigna a la
-- categoría unificada según el mapeo acordado.
--
-- Mapeo (sistema propio -> unificado):
--   VEREDAS      -> ACERAS
--   ARBOLADO     -> ARBOLES/PLAZAS/PARQUES
--   BACHES       -> CALLES
--   BASURA       -> HIGIENE Y SANEAMIENTO   (distinguible por subtipo=BASURA)
--   AGUA/CLOACAS -> HIGIENE Y SANEAMIENTO   (distinguible por subtipo=AGUA/CLOACAS)
--   TRANSPORTE   -> SEMAFOROS Y TRANSPORTE
--   ALUMBRADO, SEGURIDAD, RUIDOS, OTROS -> sin cambio de tipo (quedan igual)
--
-- Categorías nuevas sin datos propios hoy (alimentadas por MTR más adelante):
--   DEFENSA AL CONSUMIDOR, ESCUELAS, HABILITACIONES, OBRAS, VIA PUBLICA
--
-- Nota FK: reclamos_tipo_reclamo_fkey es ON UPDATE NO ACTION (no cascade),
-- por eso el catálogo nuevo se inserta ANTES de reasignar tipo_reclamo.
-- Los tipos viejos reemplazados NO se borran (evita romper histórico/FK):
-- se marcan activo=false, igual que ya hace el sistema con tipos_sugerencia.
--
-- Idempotente: puede correrse más de una vez sin duplicar ni romper nada.
-- Transaccional: si algo falla, no aplica ningún cambio.
-- ============================================================

BEGIN;

-- 1. Columna subtipo (texto libre, sin catálogo propio — ver justificación
--    en docs/DEPLOY-MTR.md: el form del panel no cambia en esta migración).
ALTER TABLE public.reclamos ADD COLUMN IF NOT EXISTS subtipo text;
ALTER TABLE public.problemas_circuito ADD COLUMN IF NOT EXISTS subtipo text;

-- 2. Backfill: preserva el tipo original de las 177 filas como subtipo,
--    ANTES de tocar tipo_reclamo.
UPDATE public.reclamos
SET subtipo = tipo_reclamo
WHERE subtipo IS NULL;

-- 3. Catálogo unificado: agrega las categorías nuevas (upsert por si se
--    re-ejecuta). Las que no cambian de nombre (ALUMBRADO, SEGURIDAD,
--    RUIDOS, OTROS) ya existen y no se tocan.
INSERT INTO public.tipos_reclamo (nombre, activo) VALUES
  ('ACERAS', true),
  ('ARBOLES/PLAZAS/PARQUES', true),
  ('CALLES', true),
  ('DEFENSA AL CONSUMIDOR', true),
  ('ESCUELAS', true),
  ('HABILITACIONES', true),
  ('HIGIENE Y SANEAMIENTO', true),
  ('OBRAS', true),
  ('SEMAFOROS Y TRANSPORTE', true),
  ('VIA PUBLICA', true)
ON CONFLICT (nombre) DO UPDATE SET activo = true;

-- 4. Reasigna tipo_reclamo en reclamos según el mapeo. Solo toca filas que
--    todavía tienen un valor viejo (idempotente: en la 2da corrida no hay
--    filas que matcheen y no hace nada).
UPDATE public.reclamos
SET tipo_reclamo = CASE tipo_reclamo
  WHEN 'VEREDAS' THEN 'ACERAS'
  WHEN 'ARBOLADO' THEN 'ARBOLES/PLAZAS/PARQUES'
  WHEN 'BACHES' THEN 'CALLES'
  WHEN 'BASURA' THEN 'HIGIENE Y SANEAMIENTO'
  WHEN 'AGUA/CLOACAS' THEN 'HIGIENE Y SANEAMIENTO'
  WHEN 'TRANSPORTE' THEN 'SEMAFOROS Y TRANSPORTE'
  ELSE tipo_reclamo
END
WHERE tipo_reclamo IN ('VEREDAS', 'ARBOLADO', 'BACHES', 'BASURA', 'AGUA/CLOACAS', 'TRANSPORTE');

-- 5. Desactiva (no borra) los tipos viejos ya reemplazados por uno nuevo.
UPDATE public.tipos_reclamo
SET activo = false
WHERE nombre IN ('VEREDAS', 'ARBOLADO', 'BACHES', 'BASURA', 'AGUA/CLOACAS', 'TRANSPORTE');

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ============================================================
-- Verificación post-migración (correr a mano después del COMMIT)
-- ============================================================
-- Debe dar 177:
--   SELECT count(*) FROM public.reclamos;
-- Debe dar 0 en ambas:
--   SELECT count(*) FROM public.reclamos WHERE tipo_reclamo IS NULL;
--   SELECT count(*) FROM public.reclamos WHERE subtipo IS NULL;
-- Comparar contra el "antes" documentado en docs/DEPLOY-MTR.md:
--   SELECT tipo_reclamo, subtipo, count(*) FROM public.reclamos GROUP BY 1,2 ORDER BY 1,2;
-- Catálogo activo esperado (14 filas):
--   SELECT nombre FROM public.tipos_reclamo WHERE activo = true ORDER BY nombre;
