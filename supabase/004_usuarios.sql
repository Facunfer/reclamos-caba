-- ============================================================
-- supabase/004_usuarios.sql
-- Gestión de usuarios: permisos de creación y rol master
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Agregar columnas de permisos a perfiles
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS can_create_users BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS is_master BOOLEAN NOT NULL DEFAULT false;

-- 2. Los usuarios comunales originales pueden crear usuarios
--    (todos los perfiles existentes al momento de correr esta migración)
UPDATE public.perfiles
  SET can_create_users = true
  WHERE created_at < now();

-- 3. Policy: los usuarios pueden ver perfiles de su propia comuna
--    (necesario para que el panel de usuarios funcione)
DROP POLICY IF EXISTS "perfiles_select_same_comuna" ON public.perfiles;
CREATE POLICY "perfiles_select_same_comuna"
  ON public.perfiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR
    comuna_id = (
      SELECT p2.comuna_id FROM public.perfiles p2 WHERE p2.user_id = auth.uid()
    )
  );

-- 4. El master puede ver TODOS los perfiles
DROP POLICY IF EXISTS "perfiles_select_master" ON public.perfiles;
CREATE POLICY "perfiles_select_master"
  ON public.perfiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.perfiles p2
      WHERE p2.user_id = auth.uid() AND p2.is_master = true
    )
  );

-- 5. Usuarios autenticados con can_create_users pueden insertar perfiles
DROP POLICY IF EXISTS "perfiles_insert_can_create" ON public.perfiles;
CREATE POLICY "perfiles_insert_can_create"
  ON public.perfiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.perfiles p2
      WHERE p2.user_id = auth.uid() AND p2.can_create_users = true
    )
  );

-- 6. Refrescar schema cache
NOTIFY pgrst, 'reload schema';
