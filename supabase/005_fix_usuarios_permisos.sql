-- ============================================================
-- supabase/005_fix_usuarios_permisos.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- PROBLEMA QUE CORRIGE:
--   La migración 004 otorgó can_create_users = true solo a los perfiles
--   que existían AL MOMENTO de correrla (WHERE created_at < now()).
--   Cualquier "responsable" de comuna sembrado/creado DESPUÉS de 004 queda
--   con can_create_users = false (default de la columna) y, por lo tanto,
--   sin acceso al flujo /panel/usuarios → /panel/usuarios/nuevo.
--
-- CRITERIO (idempotente):
--   Se considera "responsable de comuna" a todo perfil ORIGINAL, es decir,
--   aquel que NO fue creado por otro usuario (created_by IS NULL).
--   Los sub-usuarios (created_by IS NOT NULL) quedan en false a propósito,
--   para no generar cadenas infinitas de creación de usuarios.
--
--   NO se modifica is_master.
--   Es seguro re-ejecutar esta migración cuantas veces sea necesario.
-- ============================================================

UPDATE public.perfiles
  SET can_create_users = true
  WHERE created_by IS NULL
    AND can_create_users = false;

-- Verificación (opcional, solo lectura):
-- SELECT comuna_id, can_create_users, is_master, created_by
--   FROM public.perfiles ORDER BY comuna_id;

NOTIFY pgrst, 'reload schema';
