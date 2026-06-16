-- ============================================================
-- supabase/008_problemas_circuito_tipos_reclamo.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor (DESPUÉS de 007)
--
-- Los problemas de circuito ahora usan el MISMO catálogo de tipos que los
-- reclamos (public.tipos_reclamo), para que el desplegable ofrezca las mismas
-- opciones. Se repunta el FK y se elimina el catálogo propio (ya sin uso).
-- Seguro: no hay problemas_circuito cargados al momento del cambio.
-- ============================================================

-- 1. Repuntar el FK de problemas_circuito.tipo → tipos_reclamo(nombre)
ALTER TABLE public.problemas_circuito DROP CONSTRAINT IF EXISTS problemas_circuito_tipo_fkey;
ALTER TABLE public.problemas_circuito
  ADD CONSTRAINT problemas_circuito_tipo_fkey
  FOREIGN KEY (tipo) REFERENCES public.tipos_reclamo(nombre) ON UPDATE CASCADE;

-- 2. El catálogo tipos_problema_circuito queda sin uso → se elimina.
DROP TABLE IF EXISTS public.tipos_problema_circuito;

NOTIFY pgrst, 'reload schema';
