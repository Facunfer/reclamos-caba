-- ============================================================
-- supabase/010_reclamos_publicos_subtipo.sql
-- Ejecutar en: Supabase Dashboard > SQL Editor (DESPUÉS de 009)
--
-- La vista reclamos_publicos lista columnas explícitas y no reflejaba
-- automáticamente la columna `subtipo` agregada por 009. La agrega al
-- final (Postgres no permite insertar columnas en el medio de una vista
-- con CREATE OR REPLACE — solo agregar al final).
-- Necesaria para que /api/public/reclamos (integración MTR) pueda leer
-- el subtipo de los reclamos nativos.
-- Cambio aditivo y no destructivo: no rompe a nadie que ya consuma la vista.
-- ============================================================

CREATE OR REPLACE VIEW public.reclamos_publicos AS
 SELECT r.id,
    r.tipo_reclamo,
    r.urgencia,
    r.descripcion,
    r.nombre_contacto,
    r.direccion_raw,
    r.direccion_normalizada,
    r.lat,
    r.lng,
    r.estado,
    r.comuna_id,
    r.created_at,
    p.nombre AS creador_nombre,
    p.email AS creador_email,
        CASE
            WHEN p.can_create_users = false THEN p.telefono
            ELSE NULL::text
        END AS creador_telefono,
    r.subtipo
   FROM reclamos r
     LEFT JOIN perfiles p ON p.user_id = r.creado_por_user_id;

NOTIFY pgrst, 'reload schema';

-- Rollback: volver a crear la vista sin la columna subtipo (ver definición
-- original en 009_taxonomia_unificada.sql).
