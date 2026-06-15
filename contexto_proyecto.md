# Contexto del Proyecto: Reclamos y Sugerencias CABA

Este documento detalla la arquitectura, el stack tecnológico, la estructura de la base de datos y las funcionalidades principales del proyecto "Reclamos CABA", diseñado para compartir contexto rápidamente con otro asistente de IA (como Claude).

---

## 1. Stack Tecnológico

**Frontend:**
- **Framework:** Next.js 15 (App Router)
- **Librería de UI:** React 19
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS
- **Mapas:** Leaflet (`react-leaflet`) para renderizado interactivo, con Nominatim (`@usig-gcba/normalizador` en el ecosistema local) para geocodificación.
- **Gráficos:** Recharts
- **Validación:** Zod

**Backend / Database:**
- **BaaS:** Supabase
- **Base de Datos:** PostgreSQL
- **Autenticación:** Supabase Auth
- **Seguridad:** Row Level Security (RLS) en tablas.
- **Storage:** Supabase Storage (para archivos/fotos adjuntos).

---

## 2. Arquitectura y Estructura del Proyecto

El proyecto está organizado usando el App Router de Next.js:

```text
reclamos-caba/
├── src/
│   ├── app/
│   │   ├── api/                  # Endpoints (ej: /geocode, stats de reclamos/sugerencias)
│   │   ├── login/                # Página de login comunal
│   │   ├── panel/                # Panel privado de la comuna (listado, cambio de estado, nuevo reclamo/sugerencia)
│   │   ├── public/               # Dashboards públicos (mapas y charts)
│   │   │   └── sugerencias/      # Dashboard público específico de sugerencias
│   │   ├── layout.tsx & globals.css
│   ├── components/
│   │   ├── map/                  # Componentes de Leaflet (importados dinámicamente para evitar errores SSR)
│   │   ├── charts/               # Componentes de Recharts
│   │   └── ui/                   # Componentes base y formularios
│   ├── lib/
│   │   ├── supabase/             # Clientes de Supabase (browser, server, service role)
│   │   └── geocode.ts            # Utilidad de proxy para Nominatim con caché
│   └── types/                    # Interfaces globales (Reclamo, Sugerencia, Perfil, etc.)
├── scripts/                      # Scripts (ej: seed-users.ts para popular las comunas)
└── supabase/                     # Migraciones SQL y configuración
    ├── 001_incremental.sql       # Esquema base (reclamos, perfiles, views)
    ├── 002_sugerencias.sql       # Tablas de sugerencias
    └── 003_archivos.sql          # Tablas de soporte para archivos/imágenes
```

---

## 3. Base de Datos y Esquema

El sistema diferencia entre **Reclamos** (problemas a solucionar) y **Sugerencias** (ideas o mejoras). La estructura es la siguiente:

### Tablas Principales
1. **`reclamos` / `sugerencias`**
   - **Campos:** `id`, `tipo` (FK a tipos), `urgencia` (BAJA, MEDIA, ALTA), `descripcion`, `nombre_contacto`, `telefono_contacto` (Dato sensible), `direccion_raw`, `direccion_normalizada`, `lat`, `lng`, `estado` (ej. nuevo, en_proceso, resuelto), `comuna_id`, `creado_por_user_id`, `created_at`, `updated_at`.
2. **`tipos_reclamo` / `tipos_sugerencia`**
   - Catálogo de tipos habilitados (`id`, `nombre`, `activo`).
3. **`perfiles`**
   - Vincula usuarios autenticados (`user_id`) con su respectiva comuna (`comuna_id`).
4. **`reclamo_archivos`** (y equivalentes)
   - Archivos vinculados (fotos, documentos) usando Supabase Storage.

### Vistas Públicas (`reclamos_publicos`, `sugerencias_publicas`)
Para exponer datos en el mapa público de forma segura, se utilizan vistas (`VIEW`) de PostgreSQL que **enmascaran o excluyen datos sensibles** (como el teléfono de contacto).

### Seguridad y RLS (Row Level Security)
- **Comunas (Authenticated):** Solo pueden visualizar, editar (cambiar estado) y crear registros correspondientes a su propio `comuna_id`.
- **Público (Anon):** Solo puede acceder mediante `SELECT` a las vistas públicas (`reclamos_publicos`, `sugerencias_publicas`) y catálogos de tipos.

---

## 4. Funcionalidades Principales

### 1. Dashboards Públicos (`/public` y `/public/sugerencias`)
- **Mapa Interactivo:** Marcadores renderizados por color según la urgencia de la incidencia (rojo, amarillo, verde). Al hacer click se muestra un popup con info (sin revelar datos de contacto).
- **Métricas Visuales:** Gráficos de barra (incidencias por tipo) y gráficos de línea temporal (incidencias por día) gestionados con Recharts.
- **Filtros (Client-Side):** Permiten filtrar el set de datos cargado en base a comuna, tipo, estado y fechas.

### 2. Panel Privado Comunal (`/panel` y derivados)
- **Gestión:** Cada comuna inicia sesión (`comunaXX@reclamos.gob.ar`) y accede a una tabla/vista privada donde ven únicamente los reclamos/sugerencias de su jurisdicción.
- **Actualización:** Permite cambiar rápidamente el estado de la incidencia (ej: de "nuevo" a "en_proceso").
- **Alta Manual:** Formularios para cargar reclamos (`/panel/nuevo`), los cuales geocodifican la dirección automáticamente.

### 3. Geocodificación y Normalización
- Al crear una incidencia con una dirección (ej. "Corrientes 1200"), el backend intercepta la llamada, consulta el servicio público de Nominatim para obtener latitud/longitud y la normaliza.
- Si Nominatim falla (por rate limit u otro motivo), el registro igual se persiste sin coordenadas geográficas (`lat: null`, `lng: null`) y se indica "SIN GEO" en el panel.

---

## 5. Decisiones de Diseño e Integración
- **Carga Dinámica de Mapas:** El componente del mapa de Leaflet se importa vía `next/dynamic` con `ssr: false`, ya que hace uso explícito de APIs del navegador (Window) que fallarían en el servidor de Next.js.
- **Server y Client Components:** El proyecto busca un equilibrio manteniendo endpoints y fetching en el server (`Server Actions` o ruteros en `/api`), pero delegando la interactividad (filtrado, gráficos y mapa) a componentes tipo `'use client'`.
- **Seed y Testeo:** Existe un script `seed-users.ts` que auto-genera los usuarios en Supabase Auth y crea los perfiles de prueba para las 15 comunas de la Ciudad.
