# Reclamos CABA

Sistema de gestión de reclamos por comuna para la Ciudad Autónoma de Buenos Aires.

- **Frontend**: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- **Backend**: Supabase (Auth + PostgreSQL + RLS)
- **Mapa**: Leaflet + OpenStreetMap (Nominatim geocoding)
- **Charts**: Recharts

---

## Estructura del proyecto

```
reclamos-caba/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── geocode/route.ts        # Nominatim proxy con cache
│   │   │   └── reclamos/stats/route.ts # Datos agregados para charts
│   │   ├── login/page.tsx              # Página de login
│   │   ├── panel/
│   │   │   ├── layout.tsx              # Layout con nav (protegido)
│   │   │   ├── page.tsx                # Listado de reclamos + filtros
│   │   │   └── nuevo/page.tsx          # Formulario nuevo reclamo
│   │   ├── public/page.tsx             # Vista pública (mapa + charts)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── map/MapaLeaflet.tsx         # Mapa Leaflet (dynamic import)
│   │   ├── charts/Charts.tsx           # Barras + Línea (Recharts)
│   │   ├── ui/
│   │   │   ├── PanelNav.tsx
│   │   │   ├── ReclamosTable.tsx
│   │   │   └── NuevoReclamoForm.tsx
│   │   └── PublicPageClient.tsx        # Filtros + mapa + charts integrados
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts               # Browser client
│   │   │   └── server.ts               # Server + Service Role clients
│   │   └── geocode.ts                  # Nominatim con rate-limit + cache
│   ├── types/index.ts
│   └── middleware.ts                   # Auth guard
├── scripts/seed-users.ts               # Crea 15 usuarios + perfiles
├── supabase/001_incremental.sql        # SQL: ALTER, RLS, VIEW
└── .env.local.example
```

---

## Setup paso a paso

### 1. Clonar e instalar

```bash
git clone <repo>
cd reclamos-caba
npm install
```

### 2. Variables de entorno

Copiar `.env.local.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

Obtener los valores desde: Supabase Dashboard → Project Settings → API.

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` nunca debe exponerse en el cliente. Solo se usa en servidor (scripts + server components).

### 3. Aplicar SQL incremental

En el **Supabase Dashboard → SQL Editor**, ejecutar el contenido de:

```
supabase/001_incremental.sql
```

**Qué hace este SQL:**
- `ALTER TABLE reclamos` agrega columnas faltantes: `urgencia`, `updated_at`, `lat`, `lng`, `estado`, `creado_por_user_id`, `direccion_normalizada`
- Crea índices para performance
- Crea trigger `set_updated_at`
- `ALTER TABLE perfiles` agrega `user_id`, `comuna_id`, `created_at`
- Crea/reemplaza la VIEW `reclamos_publicos` **sin teléfono real** (enmascarado)
- Activa RLS en `reclamos`, `perfiles`, `tipos_reclamo`
- Crea policies: comunas solo ven/editan sus propios reclamos
- Grants públicos (anon) sobre `reclamos_publicos` y `tipos_reclamo`

> Si `reclamos_publicos` era una **tabla** (no view), ejecutar primero:
> ```sql
> DROP TABLE IF EXISTS public.reclamos_publicos;
> ```
> Y luego el resto del script.

### 4. Crear los 15 usuarios

```bash
npm run seed:users
```

Esto crea:
- 15 usuarios en Supabase Auth: `comuna01@reclamos.gob.ar` … `comuna15@reclamos.gob.ar`
- 15 registros en `perfiles` con `comuna_id` = 1 a 15
- Password inicial: `Cambiar123!`

> Cambiar el dominio del email en `scripts/seed-users.ts` → `EMAIL_DOMAIN` si lo necesitás.

### 5. Correr en local

```bash
npm run dev
```

Accesos:
- `http://localhost:3000` → redirige a `/public` (mapa público)
- `http://localhost:3000/login` → login comunal
- `http://localhost:3000/panel` → panel privado (requiere login)

---

## Deploy en Vercel

### 1. Push a GitHub

```bash
git init && git add . && git commit -m "init"
git remote add origin https://github.com/tu-usuario/reclamos-caba.git
git push -u origin main
```

### 2. Importar en Vercel

1. Ir a [vercel.com](https://vercel.com) → Add New Project
2. Importar el repo de GitHub
3. Framework: **Next.js** (auto-detectado)
4. Agregar variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click en **Deploy**

---

## Seguridad (RLS)

| Tabla/View | anon | authenticated |
|---|---|---|
| `tipos_reclamo` | SELECT (activos) | SELECT |
| `reclamos_publicos` | SELECT | SELECT |
| `perfiles` | ❌ | SELECT propio |
| `reclamos` | ❌ | SELECT/INSERT/UPDATE/DELETE solo su comuna |

**Garantías:**
- Un usuario de comuna 3 **no puede** ver ni crear reclamos de otras comunas
- La vista pública **no expone** teléfonos reales (enmascarados con `*`)
- `SUPABASE_SERVICE_ROLE_KEY` solo se usa en servidor (seed script + `createServiceClient`)

---

## Geocodificación (Nominatim)

- Endpoint: `GET /api/geocode?q=<direccion>`
- Usa [Nominatim de OpenStreetMap](https://nominatim.org/) (gratuito, sin API key)
- Rate limit: 1 request/segundo (política de uso de Nominatim)
- Cache en memoria durante el ciclo de vida del servidor
- Si falla → el reclamo se guarda con `lat=null`, `lng=null`
- En el mapa y la tabla se muestra "SIN GEO"

---

## Funcionalidades

### Panel comunal (`/panel`)
- Listado paginado de reclamos de la propia comuna
- Filtros: estado, urgencia
- Cambio rápido de estado desde la tabla
- Badge de urgencia (ALTA/MEDIA/BAJA) con colores

### Nuevo reclamo (`/panel/nuevo`)
- Selección de tipo desde `tipos_reclamo`
- Urgencia con botones visuales
- Geocodificación automática al hacer submit
- Si geocode falla, se guarda igual

### Vista pública (`/public`)
- Mapa Leaflet con markers de colores por urgencia (rojo/amarillo/verde)
- Popup con: tipo, urgencia, estado, comuna, dirección, descripción (sin teléfono)
- Filtros: comuna, tipo, urgencia, estado, rango de fechas
- Gráfico de barras por tipo de reclamo
- Gráfico de línea por día
- Todo se filtra en cliente sobre los últimos 500 reclamos

---

## Notas adicionales

- Los charts y el mapa se filtran en el cliente para evitar round-trips innecesarios
- Para datasets grandes (> 2000 reclamos) considerar mover los filtros a server-side con el endpoint `/api/reclamos/stats`
- Leaflet se importa con `dynamic()` + `ssr: false` para evitar errores de SSR
- El trigger `set_updated_at` actualiza automáticamente la columna al hacer UPDATE
