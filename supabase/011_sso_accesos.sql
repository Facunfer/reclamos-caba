-- ===========================================================================
-- 011 — Registro de accesos por SSO desde el Portal Territorial
-- ===========================================================================
--
-- Contexto: hasta ahora este sistema no guardaba NINGÚN registro de accesos.
-- Al panel comunal se entra con una contraseña compartida por comuna y al
-- dashboard público con una sola contraseña para todos, así que la pregunta
-- "¿quién entró y cuándo?" no tenía respuesta en ningún lado.
--
-- El puente con el Portal agrega un camino de entrada más. Esta tabla existe
-- para que ese camino, a diferencia de los otros dos, sí deje rastro.
--
-- Ejecutar en el SQL Editor de Supabase, proyecto "reclamos"
-- (aysbehxlrgtacjdwmhsp). Idempotente: se puede correr dos veces.

create table if not exists public.sso_accesos (
  id            uuid primary key default gen_random_uuid(),

  -- Identidad del lado del PORTAL. Se guarda el id y el username juntos a
  -- propósito: el id es estable pero ilegible, y el username es legible pero
  -- se puede cambiar. Guardar los dos deja el registro entendible dentro de
  -- un año sin depender de que el Portal no haya renombrado a nadie.
  portal_uid     integer not null,
  portal_usuario text    not null,

  comuna_id      smallint not null check (comuna_id between 1 and 15),

  -- Cuenta de Auth de ESTE proyecto con la que se abrió la sesión.
  -- `on delete set null`: borrar un usuario no tiene que borrar la historia de
  -- lo que hizo, que es justo lo que se quiere poder auditar.
  user_id        uuid references auth.users(id) on delete set null,

  -- Identificador del pase canjeado. Único: es la garantía, a nivel base, de
  -- que un token de un solo uso no se canjeó dos veces. El chequeo en memoria
  -- del proceso es la primera línea; esto lo sobrevive a un reinicio.
  jti            text not null unique,

  created_at     timestamptz not null default now()
);

create index if not exists idx_sso_accesos_portal_uid  on public.sso_accesos (portal_uid);
create index if not exists idx_sso_accesos_created_at  on public.sso_accesos (created_at desc);
create index if not exists idx_sso_accesos_comuna      on public.sso_accesos (comuna_id);

-- RLS activada y SIN políticas: nadie llega a esta tabla con la anon key, ni
-- para leer ni para escribir. La escribe el endpoint del puente con la Service
-- Role Key, que bypassa RLS, y se lee desde el panel de Supabase.
--
-- Un registro de accesos que los propios usuarios pueden leer o borrar no es un
-- registro de accesos.
alter table public.sso_accesos enable row level security;

comment on table public.sso_accesos is
  'Canjes del puente de sesión con el Portal Territorial. Solo escribe el endpoint /api/sso/exchange con service_role.';
