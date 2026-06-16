# Documentación Técnica — Reclamos y Sugerencias CABA

> Documento de arquitectura y funcionamiento integral del sistema, redactado desde la perspectiva de desarrollo full‑stack y arquitectura de datos. Describe el stack, el modelo de datos, los flujos de negocio, la seguridad y las decisiones de diseño con suficiente detalle para operar, mantener y extender la plataforma.

**Última actualización:** 2026-06-12
**Versión del proyecto:** 0.1.0

---

## 1. Visión general

**Reclamos CABA** es una aplicación web para la **gestión territorial de reclamos y sugerencias** de la Ciudad Autónoma de Buenos Aires, organizada por **comuna** (1 a 15). El sistema cumple dos roles complementarios:

1. **Panel privado comunal** (`/panel`): cada comuna inicia sesión y administra únicamente *sus* reclamos y sugerencias — los carga manualmente, los visualiza y adjunta fotos. La pertenencia a la comuna se aplica a nivel de base de datos vía Row Level Security (RLS).
2. **Dashboard público** (`/public`): mapa interactivo, analítica (gráficos por tipo y por día) y exportación a CSV de todos los reclamos/sugerencias, **sin exponer datos sensibles** (el teléfono de contacto se enmascara). Está detrás de un *gate* de acceso simple ("MASTER").

Dos entidades paralelas estructuran el dominio:

| Entidad | Naturaleza | Estados |
|---|---|---|
| **Reclamo** | Problema a resolver (bache, luminaria, etc.) | `nuevo` → `en_proceso` → `resuelto` / `descartado` |
| **Sugerencia** | Idea o propuesta de mejora | `nuevo` → `en_evaluacion` → `aprobado` / `rechazado` |

Ambas comparten estructura casi idéntica (tipo, urgencia, descripción, contacto, geolocalización, comuna, archivos adjuntos).

---

## 2. Stack tecnológico

### Frontend
- **Next.js 15** con **App Router** (Server Components + Client Components).
- **React 19** y **TypeScript**.
- **Tailwind CSS** (tema oscuro propio; clases utilitarias `lla-card`, `lla-input`, `lla-btn-primary`).
- **Leaflet** + **react-leaflet 5** para el mapa interactivo (importado dinámicamente, sin SSR).
- **Recharts** para gráficos (barras por tipo, línea temporal por día).
- **Zod** disponible para validación de esquemas.

### Backend / Datos
- **Supabase** como BaaS:
  - **PostgreSQL** (base de datos relacional).
  - **Supabase Auth** (autenticación por email/contraseña).
  - **Row Level Security (RLS)** como capa principal de autorización.
  - **Supabase Storage** (buckets públicos para fotos y documentos).
- **API Routes de Next.js** (`src/app/api/*`) para proxys de geocodificación, GeoJSON y estadísticas.
- **`@supabase/ssr`** para manejo de sesión basado en cookies en server/middleware/browser.

### Servicios externos
- **USIG (GCABA)** — normalizador y geocoder oficial de la Ciudad: `servicios.usig.buenosaires.gob.ar`.
- **Nominatim (OpenStreetMap)** — geocoder de *fallback*.
- **CDN de datos abiertos de Buenos Aires** — GeoJSON de comunas y barrios.
- **OpenStreetMap tiles** — capa base del mapa.

---

## 3. Estructura del proyecto

```text
reclamos-caba/
├── src/
│   ├── middleware.ts                  # Protección de rutas /panel y /login (sesión Supabase)
│   ├── app/
│   │   ├── page.tsx                   # Redirige "/" → "/public"
│   │   ├── layout.tsx, globals.css    # Layout raíz y estilos globales
│   │   ├── login/page.tsx             # Login comunal (Supabase Auth)
│   │   ├── api/
│   │   │   ├── geocode/route.ts       # Proxy USIG + Nominatim (sugerencias y geocodificación)
│   │   │   ├── comunas/route.ts       # Proxy GeoJSON de comunas (cache 24h)
│   │   │   ├── barrios/route.ts       # Proxy GeoJSON de barrios (cache 24h)
│   │   │   ├── reclamos/stats/route.ts# Agregados (barras/línea) sobre la vista pública
│   │   │   └── usuarios/crear/route.ts# Alta de usuarios (Admin API, requiere permiso)
│   │   ├── panel/                     # ÁREA PRIVADA (requiere sesión)
│   │   │   ├── layout.tsx             # Navbar + guard de sesión
│   │   │   ├── page.tsx               # Listado paginado de reclamos de la comuna
│   │   │   ├── nuevo/page.tsx         # Alta de reclamo
│   │   │   ├── sugerencias/
│   │   │   │   ├── page.tsx           # Listado de sugerencias de la comuna
│   │   │   │   └── nuevo/page.tsx     # Alta de sugerencia
│   │   │   └── usuarios/
│   │   │       ├── page.tsx           # Gestión de usuarios (si tiene permiso)
│   │   │       └── nuevo/page.tsx     # Alta de usuario comunal
│   │   └── public/                    # ÁREA PÚBLICA (gate "MASTER" client-side)
│   │       ├── layout.tsx             # PublicAuthGuard
│   │       ├── page.tsx               # Dashboard de reclamos (mapa + charts + export)
│   │       ├── sugerencias/page.tsx   # Dashboard de sugerencias
│   │       └── comunas/page.tsx       # Directorio de equipos/usuarios por comuna
│   ├── components/
│   │   ├── map/MapaLeaflet.tsx        # Mapa Leaflet + markers + dibujo de polígono
│   │   ├── charts/Charts.tsx         # Gráficos Recharts
│   │   ├── PublicPageClient.tsx       # Lógica cliente del dashboard de reclamos
│   │   ├── PublicSugerenciasClient.tsx# Lógica cliente del dashboard de sugerencias
│   │   └── ui/                        # Formularios, tablas, filtros, navbar, guards
│   ├── lib/
│   │   ├── supabase/                  # client.ts (browser), server.ts (server + service role)
│   │   ├── geocode.ts                 # USIG + Nominatim con caché y rate-limit
│   │   └── geofence.ts                # Point-in-polygon (comuna/barrio por coordenada)
│   └── types/index.ts                 # Interfaces de dominio
├── scripts/seed-users.ts             # Crea los 15 usuarios comunales de prueba
└── supabase/                         # Migraciones SQL (ejecutar en orden en el SQL Editor)
    ├── 001_incremental.sql           # reclamos, perfiles, vista pública, RLS
    ├── 002_sugerencias.sql           # tipos_sugerencia, sugerencias, vista, RLS
    ├── 003_archivos.sql              # reclamo_archivos + buckets de Storage
    ├── 004_usuarios.sql              # Permisos (can_create_users, is_master) + RLS perfiles
    ├── 005_fix_usuarios_permisos.sql # Corrige can_create_users de responsables (idempotente)
    └── 006_circuitos.sql             # PostGIS: circuitos, problemas_circuito, vista, RLS, RPCs
```

---

## 4. Modelo de datos

### 4.1 Diagrama lógico

```text
auth.users (Supabase Auth)
    │ 1
    │
    │ 1            ┌──────────── tipos_reclamo (catálogo)
perfiles ─────┐    │
 user_id      │    ▼ N
 comuna_id    │  reclamos ──────< reclamo_archivos >────── sugerencias
 can_create   │    (UUID id)        (reclamo_id |              (INTEGER id)
 is_master    │                      sugerencia_id)
              │                                              ▲ N
              │                                              │
              └──────────────────── tipos_sugerencia (catálogo)

Vistas seguras (sin teléfono completo):
  reclamos_publicos    ← reclamos
  sugerencias_publicas ← sugerencias
```

### 4.2 Tablas

#### `perfiles`
Vincula cada usuario de `auth.users` con su comuna y sus permisos administrativos.

| Columna | Tipo | Notas |
|---|---|---|
| `user_id` | UUID FK → `auth.users` | Único (`idx_perfiles_user_id`) |
| `comuna_id` | INTEGER | `CHECK BETWEEN 1 AND 15` |
| `can_create_users` | BOOLEAN | Habilita crear sub‑usuarios de la comuna |
| `is_master` | BOOLEAN | Rol global: ve todos los perfiles |
| `created_at` | TIMESTAMPTZ | |
| `created_by` | UUID | Quién dio de alta el perfil (usado para el árbol de usuarios) |
| `nombre`, `telefono`, `email`, `role` | TEXT | Metadatos de contacto del usuario |

> Nota: las migraciones SQL versionadas definen el núcleo (`user_id`, `comuna_id`, permisos). Columnas como `nombre`/`telefono`/`email`/`role`/`created_by` son escritas por el endpoint de alta de usuarios y deben existir en el esquema (agregarlas si se parte solo de las migraciones).

#### `tipos_reclamo` / `tipos_sugerencia`
Catálogos de tipos habilitados. `tipos_sugerencia` se siembra con 6 categorías (Espacio Público, Tránsito y Transporte, Medio Ambiente, Seguridad, Cultura y Deportes, Otros). Solo se exponen los `activo = true`.

#### `reclamos`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | **UUID** | PK |
| `tipo_reclamo` | TEXT | Referencia al catálogo (por nombre) |
| `urgencia` | TEXT | `CHECK ('BAJA','MEDIA','ALTA')`, default `MEDIA` |
| `descripcion` | TEXT | |
| `nombre_contacto` | TEXT | |
| `telefono_contacto` | TEXT | **Dato sensible** (enmascarado en la vista pública) |
| `direccion_raw` | TEXT | Lo que tipeó el usuario |
| `direccion_normalizada` | TEXT | Resultado de USIG/Nominatim |
| `lat`, `lng` | DOUBLE PRECISION | Pueden ser `NULL` (sin geo) |
| `estado` | TEXT | `CHECK ('nuevo','en_proceso','resuelto','descartado')` |
| `comuna_id` | INTEGER | Jurisdicción |
| `creado_por_user_id` | UUID FK → `auth.users` | |
| `created_at`, `updated_at` | TIMESTAMPTZ | `updated_at` por trigger |

Índices: `comuna_id`, `estado`, `urgencia`, `created_at DESC`, `tipo_reclamo`.

#### `sugerencias`
Espejo de `reclamos` con dos diferencias clave:
- **`id` es `SERIAL` (INTEGER)**, no UUID.
- **`estado`** usa `CHECK ('nuevo','en_evaluacion','aprobado','rechazado')`.
- `tipo_sugerencia` es FK al *nombre* de `tipos_sugerencia` (`ON UPDATE CASCADE`).

#### `reclamo_archivos`
Tabla de adjuntos **compartida** entre reclamos y sugerencias, con FKs de tipos asimétricos:

| Columna | Tipo | Notas |
|---|---|---|
| `id` | UUID | PK |
| `reclamo_id` | UUID FK → `reclamos` `ON DELETE CASCADE` | Mutuamente excluyente con… |
| `sugerencia_id` | INTEGER FK → `sugerencias` `ON DELETE CASCADE` | …`reclamo_id` |
| `tipo` | TEXT | `CHECK ('foto','pdf','documento')` |
| `storage_path` | TEXT | Ruta dentro del bucket de Storage |
| `nombre_original` | TEXT | |

> La asimetría de tipos (UUID vs INTEGER) obliga a obtener los archivos en queries separadas (con `.in("reclamo_id", ids)`) en lugar de un `join` por relación de PostgREST — ver §7.

### 4.3 Vistas públicas seguras

`reclamos_publicos` y `sugerencias_publicas` son `VIEW`s que replican las columnas seguras y **enmascaran el teléfono**, mostrando solo los últimos 4 dígitos con `regexp_replace`. Tienen `GRANT SELECT` para `anon` y `authenticated`. Son la **única** superficie de datos que consume el dashboard público.

### 4.4 Storage

Dos buckets **públicos**:
- `reclamos-fotos` — imágenes de reclamos (ruta `{reclamo_id}/{random}.{ext}`).
- `reclamos-documentos` — adjuntos de sugerencias.

Políticas: lectura pública (`anon`), escritura solo `authenticated`. Las URLs públicas se arman como
`{SUPABASE_URL}/storage/v1/object/public/{bucket}/{storage_path}`.

### 4.5 Circuitos electorales (PostGIS) — migración `006`

Tercera familia de entidades, para **problemas puntuales por circuito electoral**. Requiere **PostGIS**.

#### `circuitos` (geografía oficial)
| Columna | Tipo | Notas |
|---|---|---|
| `id` | SERIAL | PK |
| `codigo` | TEXT UNIQUE | `id_circuit` oficial (como texto) |
| `barrio` | TEXT | Del GeoJSON oficial |
| `comuna_id` | INTEGER | `CHECK 1..15` (viene como `id_comuna` en el GeoJSON) |
| `geom` | `geometry(MultiPolygon,4326)` | Índice **GIST** |
| `created_at` | TIMESTAMPTZ | |

Datos importados del GeoJSON oficial de Datos Abiertos CABA (167 circuitos, los 15 comunas). Lectura pública; sin escritura por cliente (se pueblan por `scripts/seed-circuitos.ts` con Service Role).

#### Catálogo de tipos
Los problemas de circuito usan el **mismo catálogo que los reclamos** (`public.tipos_reclamo`): `problemas_circuito.tipo` tiene FK a `tipos_reclamo(nombre)`, así el desplegable ofrece exactamente las mismas opciones (AGUA/CLOACAS, ALUMBRADO, ARBOLADO, BACHES, etc.). Definido en la migración `008`. *(La migración `006` había creado un catálogo propio `tipos_problema_circuito`, eliminado en `008`.)*

#### `problemas_circuito`
Espejo simplificado de `reclamos`: `id` UUID, `circuito_id` FK, `comuna_id` (denormalizado para RLS), `tipo` (FK a `tipos_reclamo`), `urgencia`, `descripcion`, `estado` (`nuevo/en_proceso/resuelto/descartado`), `lat`/`lng` opcionales, `creado_por_user_id`, timestamps. **RLS idéntica a `reclamos`** (acceso solo a la comuna del perfil). El master consume la vista saneada **`problemas_circuito_publicos`**.

#### Funciones (RPC) en `006`
- **`import_circuito(codigo, barrio, comuna_id, geojson)`** — convierte GeoJSON → `geometry(MultiPolygon,4326)` (`ST_GeomFromGeoJSON` + `ST_Multi`/`ST_SetSRID`) y upsertea por `codigo`. `SECURITY DEFINER`, **solo `service_role`** (la usa el seed). Necesaria porque PostgREST no inserta geometría desde GeoJSON directamente.
- **`circuitos_featurecollection(comuna_id)`** — devuelve un FeatureCollection GeoJSON (`ST_AsGeoJSON`), opcionalmente filtrado por comuna. Lectura pública. La consume `GET /api/circuitos`.

---

## 5. Autenticación, roles y autorización

El sistema tiene **dos mecanismos de acceso totalmente distintos**, uno por área.

### 5.1 Panel privado — Supabase Auth real

- Login en `/login` con email/contraseña (`signInWithPassword`). Si el usuario no escribe `@`, se completa con el dominio `@reclamos.gob.ar` (también acepta `cN@reclamos.gob.ar`).
- La sesión vive en cookies gestionadas por `@supabase/ssr`.
- **`middleware.ts`** intercepta `/panel/:path*` y `/login`:
  - Sin sesión + ruta `/panel*` → redirige a `/login`.
  - Con sesión + `/login` → redirige a `/panel`.
- Cada Server Component del panel revalida con `supabase.auth.getUser()` y carga el `perfil` para conocer `comuna_id` y permisos.

#### Jerarquía de roles (panel)

| Rol | Cómo se determina | Capacidades |
|---|---|---|
| **Usuario comunal base** | Perfil con `can_create_users = false` | Ver/crear/editar reclamos y sugerencias de **su** comuna |
| **Responsable de comuna** | `can_create_users = true` | Lo anterior + crear sub‑usuarios en su comuna + ver `/panel/usuarios` |
| **Master** | `is_master = true` | Ve **todos** los perfiles del sistema en `/panel/usuarios` |

La migración `004` marca como `can_create_users = true` a todos los perfiles preexistentes (los 15 usuarios comunales sembrados), de modo que cada comuna pueda gestionar su propio equipo.

### 5.2 Dashboard público — gate client-side ("MASTER")

`/public/*` está envuelto por **`PublicAuthGuard`** (componente cliente):
- Pide usuario/contraseña comparados contra `NEXT_PUBLIC_MASTER_USER` / `NEXT_PUBLIC_MASTER_PASS` (defaults `MASTER` / `123456`).
- Si coinciden, guarda `public_auth = "true"` en `sessionStorage`.

> ⚠️ **Esto NO es seguridad real**: las credenciales viven en variables `NEXT_PUBLIC_*` (expuestas al navegador) y la validación es 100 % client-side. Es un *speed bump* para evitar acceso casual, no una barrera criptográfica. Los datos que protege ya están filtrados por la vista pública (sin teléfono completo). Si se requiere control real, debe migrarse a auth server-side.

### 5.3 Row Level Security (la autorización que importa)

Toda la autorización de datos vive en PostgreSQL. Patrón común para `reclamos` y `sugerencias`:

```sql
-- SELECT / UPDATE / DELETE: solo la comuna del perfil del usuario
USING (comuna_id = (SELECT p.comuna_id FROM perfiles p WHERE p.user_id = auth.uid()))

-- INSERT: además exige que el autor sea uno mismo
WITH CHECK (creado_por_user_id = auth.uid() AND comuna_id = (SELECT ...))
```

- **`perfiles`**: cada uno ve el suyo; un usuario ve los de su misma comuna; un *master* ve todos; insertar perfiles requiere `can_create_users`.
- **`tipos_*`**: lectura pública solo de `activo = true`.
- **Vistas públicas**: `GRANT SELECT` a `anon`/`authenticated`; sin RLS adicional porque ya están saneadas.
- **`reclamo_archivos`**: lectura para todos, inserción para `authenticated`.

**Consecuencia arquitectónica:** un usuario comunal autenticado, aun manipulando el cliente, **no puede leer ni alterar** reclamos de otra comuna — la base de datos lo rechaza. Las operaciones que deben saltarse RLS (listar usuarios de Auth, ver emails) usan el **Service Role Key** únicamente desde el servidor.

### 5.4 Clientes Supabase

`src/lib/supabase/` expone tres formas de cliente:
- **`client.ts`** → `createBrowserClient` (anon key) para componentes cliente.
- **`server.ts` → `createClient()`** → `createServerClient` con cookies (anon key, respeta RLS).
- **`server.ts` → `createServiceClient()`** y `createAdminClient` de `@supabase/supabase-js` → **Service Role Key**, *bypassa RLS*. Solo se usa server-side para tareas administrativas (alta de usuarios, leer emails de `auth.users`).

---

## 6. Flujos funcionales

### 6.1 Alta de un reclamo (panel) — con geocodificación

`/panel/nuevo` → `NuevoReclamoForm` (cliente):

1. El usuario tipea la dirección. Con **debounce de 500 ms** se llama a `GET /api/geocode?q=...&suggestions=true`, que consulta el **normalizador USIG** filtrando estrictamente direcciones de **CABA**.
2. Aparece un dropdown de sugerencias. Al seleccionar una:
   - Si USIG ya devolvió coordenadas → estado geo = `ok`.
   - Si no → se fuerza `GET /api/geocode?q=...` para resolver lat/lng.
3. El submit **exige** `geoStatus === "ok"` (no se puede guardar sin dirección validada). Se re‑geocodifica una vez más para asegurar datos limpios.
4. Se inserta el reclamo vía cliente **anon** (RLS valida `comuna_id` y `creado_por_user_id`).
5. Si hay fotos (máx. 5): se suben a `reclamos-fotos` con ruta `{reclamo_id}/{random}.{ext}` y se registra cada una en `reclamo_archivos`. Si el bucket no existe, se informa al usuario.
6. Redirige a `/panel` y refresca.

El alta de **sugerencias** (`/panel/sugerencias/nuevo`) sigue el mismo patrón con su catálogo y estados propios.

### 6.2 Cadena de geocodificación (`lib/geocode.ts`)

Estrategia en cascada con **caché en memoria** (`Map`) y **rate-limit** de 1200 ms para Nominatim:

1. **USIG Normalizar** (`/normalizar/?...&excluirFueraCABA=true`) — si trae `coordenadas {x,y}`, listo.
2. **USIG Geocoder 2.2** (`/geocoder/2.2/geocoding/?q=...`) — segundo intento.
3. **Nominatim** (`nominatim.openstreetmap.org/search`, con `User-Agent` propio) — *fallback*, respetando la política de 1 req/seg.
4. Si todo falla → se cachea `null` y el reclamo puede persistirse **sin coordenadas** (en el panel se marca `ERR`; en el mapa simplemente no aparece).

`x` = longitud, `y` = latitud (convención USIG/GeoJSON), invertidas respecto al orden `lat,lng` de Leaflet — el código las mapea explícitamente.

### 6.3 Dashboard público (reclamos)

`/public/page.tsx` (Server Component, `revalidate = 60`):
1. Carga `tipos_reclamo` activos y **todos** los `reclamos_publicos`.
2. Con el **admin client** arma el directorio de contactos por comuna (email de los responsables desde `auth.users`).
3. Entrega todo a `PublicPageClient`.

`PublicPageClient` (cliente) concentra la interactividad:
- **Filtros client-side**: comuna, barrio, tipo, urgencia, rango de fechas.
- **Filtrado geoespacial real**: el filtro por comuna/barrio no usa `comuna_id` almacenado sino **point-in-polygon** (`lib/geofence.ts`) sobre el GeoJSON oficial — la comuna se deriva de las coordenadas. Esto corrige inconsistencias entre la comuna cargada y la ubicación real.
- **Filtro por zona dibujada**: el usuario dibuja un polígono sobre el mapa (modo dibujo → puntos → confirmar) y solo se muestran los puntos contenidos (ray-casting).
- **Carga diferida de archivos**: tras render, busca los adjuntos de cada reclamo por `reclamo_id`.
- **Gráficos**: agrega localmente `barras` (por tipo) y `linea` (por día) y los pasa a Recharts.
- **Exportación CSV**: genera un CSV (con BOM UTF‑8) de los reclamos filtrados, incluyendo URLs públicas de las fotos y datos del creador.

El mapa (`MapaLeaflet`) renderiza markers coloreados por **hash determinístico del tipo** (color estable por categoría), hace `fitBounds` automático, muestra popups con detalle (tipo, urgencia, comuna, dirección, adjuntos, creador) y soporta el dibujo de polígonos.

### 6.4 Estadísticas server-side (`/api/reclamos/stats`)

Endpoint alternativo que agrega sobre `reclamos_publicos` aplicando los mismos filtros vía query params y devuelve `{ barras, linea }`. Útil para clientes que no quieran cargar el dataset completo (el dashboard actual agrega en el cliente).

### 6.5 Gestión de usuarios

- **`/panel/usuarios`** (Server Component, `force-dynamic`): solo accesible con `can_create_users` o `is_master`. Usa el **admin client** para listar perfiles + emails de Auth. Un *master* ve todos; un responsable ve su propio perfil, los que él creó y sub‑usuarios legados de su comuna.
- **`POST /api/usuarios/crear`**: valida sesión y `can_create_users`; crea el usuario con la **Admin API** (`email_confirm: true`), inserta su perfil en la **misma comuna** con `can_create_users = false`, y hace **rollback** (borra el usuario Auth) si falla la creación del perfil. Patrón transaccional manual.
- **`/public/comunas`**: directorio público de equipos por comuna (responsable + adicionales), también vía admin client.

---

## 7. Decisiones de diseño y notas de arquitectura

- **Mapa sin SSR**: `MapaLeaflet` y `Charts` se importan con `next/dynamic({ ssr: false })` porque Leaflet usa `window`. Los íconos default de Leaflet se reconfiguran a URLs de CDN (workaround clásico de bundlers).
- **Separación Server/Client**: el *fetching* y la sesión viven en Server Components; la interactividad (filtros, gráficos, dibujo, formularios) en Client Components marcados `"use client"`.
- **Archivos en query separada**: por la FK asimétrica de `reclamo_archivos` (UUID vs INTEGER), PostgREST no resuelve la relación de forma fiable; el código trae los reclamos y luego los archivos con `.in(...)`, uniéndolos en memoria. Evita "relationship cache issues".
- **Geofencing como fuente de verdad territorial**: la comuna/barrio mostrados se derivan de las coordenadas contra el GeoJSON oficial, no del `comuna_id` guardado. Los GeoJSON se proxean por `/api/comunas` y `/api/barrios` con caché de 24 h (evita CORS y reduce llamadas a la CDN).
- **Defensa en profundidad real = RLS**: la autorización efectiva está en la base. Los *gates* de UI (middleware, PublicAuthGuard) son conveniencia/UX; aunque se vulneren, RLS impide leer datos de otra comuna con la anon key.
- **Service Role solo en servidor**: nunca se expone al cliente; se usa para operaciones que legítimamente deben saltar RLS (Auth admin, emails).
- **Caché de geocodificación en memoria**: vive por proceso/instancia serverless; no es compartida ni persistente. Suficiente para deduplicar dentro de una sesión de uso, no como caché global.

---

## 8. Configuración y puesta en marcha

### 8.1 Variables de entorno (`.env.local`)

| Variable | Uso | Exposición |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | Pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (respeta RLS) | Pública |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (bypassa RLS) | **Secreta — solo server** |
| `NEXT_PUBLIC_MASTER_USER` | Usuario del gate público (default `MASTER`) | Pública |
| `NEXT_PUBLIC_MASTER_PASS` | Contraseña del gate público (default `123456`) | Pública |

### 8.2 Pasos de instalación

```bash
# 1. Dependencias
npm install

# 2. Base de datos: ejecutar EN ORDEN en Supabase → SQL Editor
#    supabase/001_incremental.sql
#    supabase/002_sugerencias.sql
#    supabase/003_archivos.sql
#    supabase/004_usuarios.sql

# 3. Sembrar los 15 usuarios comunales de prueba
#    (crea c1..c15@reclamos.gob.ar / 123456 y sus perfiles)
npm run seed:users

# 4. Desarrollo
npm run dev          # http://localhost:3000  → redirige a /public
```

Scripts disponibles: `dev`, `build`, `start`, `seed:users`.

### 8.3 Credenciales de prueba

- **Panel comunal**: `c1` … `c15` (o `cN@reclamos.gob.ar`) / contraseña `123456`.
- **Dashboard público**: usuario `MASTER` / `123456` (configurable por env).

> Estas credenciales por defecto (incluido el password `123456`) son de **desarrollo**. Antes de cualquier despliegue real deben rotarse y el gate público debe reemplazarse por autenticación server-side.

---

## 9. Mapa de rutas

| Ruta | Tipo | Acceso | Función |
|---|---|---|---|
| `/` | Redirect | — | → `/public` |
| `/login` | Página | Público | Login comunal (Supabase Auth) |
| `/panel` | Página | Sesión | Listado paginado de reclamos de la comuna |
| `/panel/nuevo` | Página | Sesión | Alta de reclamo |
| `/panel/sugerencias` | Página | Sesión | Listado de sugerencias de la comuna |
| `/panel/sugerencias/nuevo` | Página | Sesión | Alta de sugerencia |
| `/panel/usuarios` | Página | `can_create_users`/`master` | Gestión de usuarios |
| `/panel/usuarios/nuevo` | Página | `can_create_users` | Alta de usuario comunal |
| `/panel/circuitos` | Página | Sesión | Mapa de circuitos de la comuna + alta de problemas |
| `/public` | Página | Gate MASTER | Dashboard de reclamos |
| `/public/sugerencias` | Página | Gate MASTER | Dashboard de sugerencias |
| `/public/circuitos` | Página | Gate MASTER | Mapa de todos los circuitos + problemas (saneados) |
| `/public/comunas` | Página | Gate MASTER | Directorio de equipos por comuna |
| `/api/geocode` | API GET | — | Sugerencias + geocodificación (USIG/Nominatim) |
| `/api/comunas` | API GET | — | GeoJSON de comunas (cache 24h) |
| `/api/barrios` | API GET | — | GeoJSON de barrios (cache 24h) |
| `/api/circuitos` | API GET | — | FeatureCollection de circuitos (RPC, cache 24h) |
| `/api/reclamos/stats` | API GET | — | Agregados barras/línea sobre vista pública |
| `/api/usuarios/crear` | API POST | `can_create_users` | Alta de usuario (Admin API) |

---

## 10. Riesgos conocidos y mejoras sugeridas

1. **Gate público inseguro** (§5.2): credenciales en `NEXT_PUBLIC_*` y validación client-side. *Mejora:* mover a auth server-side o a un middleware que valide un token real.
2. **Sin cambio de estado en la UI del panel**: la tabla de reclamos muestra los datos pero el flujo de transición de estado (`nuevo → en_proceso → resuelto`) no tiene control visible en `ReclamosTable`. Las RLS de `UPDATE` ya lo permiten; falta exponerlo en la interfaz.
3. **Caché de geocodificación efímera**: por instancia y no persistente. *Mejora:* persistir normalizaciones en una tabla para reusarlas entre sesiones.
4. **Acoplamiento `reclamo_archivos`**: una sola tabla para dos entidades con PKs de distinto tipo complica las queries. *Mejora:* evaluar tablas separadas o una columna discriminadora más explícita.
5. **Buckets públicos**: cualquiera con la URL puede ver una foto. Aceptable si no hay datos personales en imágenes; de lo contrario, usar URLs firmadas.
6. **Contraseñas por defecto `123456`**: rotar antes de producción.

---

*Fin del documento.*
