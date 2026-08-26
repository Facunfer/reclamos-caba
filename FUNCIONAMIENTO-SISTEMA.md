# Cómo funciona el sistema — Reclamos CABA

> Explicación integral del sistema para alguien que no lo desarrolló: qué es, cómo está armado, cómo fluyen los datos y cómo se opera.
> Generado a partir del código del proyecto y de la base de datos real en producción.
> **Fecha:** 2026-08-25

---

## 1. Qué es este sistema, en una frase

Una aplicación web donde **las 15 comunas de la Ciudad de Buenos Aires cargan reclamos y sugerencias de vecinos**, y esos datos se ven en un **mapa público** con estadísticas, sin que ninguna comuna pueda ver ni tocar los datos de otra.

Convive en el mismo servidor con otras dos apps del organismo (una llamada `mapa` en el puerto 3000 y un portal Streamlit en el 8501), pero es un proyecto **totalmente independiente** con su propia base de datos.

---

## 2. Las dos caras del sistema

### 2.1 Panel privado (`/panel`) — uso interno de cada comuna

Cada comuna tiene un usuario y contraseña (`c1@reclamos.gob.ar` … `c15@reclamos.gob.ar`). Al entrar:

- Ve **únicamente** los reclamos y sugerencias que cargó su propia comuna.
- Puede cargar un reclamo nuevo: escribe la dirección, el sistema la geocodifica automáticamente (le pone latitud/longitud), elige tipo de problema (bache, alumbrado, arbolado, etc.) y nivel de urgencia (BAJA/MEDIA/ALTA), y opcionalmente adjunta hasta 5 fotos.
- Puede cargar sugerencias (ideas/propuestas de vecinos) de la misma forma.
- Si el usuario tiene permiso de "responsable", además puede dar de alta a otros usuarios de su misma comuna.
- Existe también un panel de **circuitos electorales**, donde se pueden cargar problemas puntuales asociados a un circuito específico (usa el mismo catálogo de tipos que los reclamos).

Esto es exactamente lo que ya consultamos en la base: **177 reclamos cargados**, repartidos entre las comunas así (por usuario que los cargó, no por dónde está el problema):

| Comuna | Reclamos cargados |
|---|---|
| 3 | 1 |
| 4 | 67 |
| 8 | 16 |
| 9 | 4 |
| 11 | 6 |
| 12 | 21 |
| 13 | 30 |
| 14 | 32 |

La Comuna 4 concentra el 38% de toda la carga.

### 2.2 Dashboard público (`/public`) — para quien tenga la clave "MASTER"

No requiere ser de una comuna. Pide un usuario/contraseña genérico y muestra:

- **Mapa interactivo** (Leaflet) con todos los reclamos como marcadores de colores.
- **Gráficos**: cantidad por tipo de problema (apiladas según el origen del reclamo) y evolución día a día.
- **Filtros**: por origen, comuna, barrio, tipo, subtipo, urgencia y rango de fechas — incluso se puede **dibujar un polígono a mano sobre el mapa** y filtrar solo lo que cae adentro.
- **Exportación a CSV** de todo lo filtrado.

Un detalle importante: en el dashboard público, la comuna/barrio que se muestra **no es el dato que cargó el usuario**, sino el que resulta de ubicar las coordenadas (lat/lng) dentro del mapa oficial de comunas de la Ciudad. Esto corrige el caso en que alguien cargó mal la comuna a mano.

**Cómo se protege el acceso.** La contraseña se valida en el servidor y nunca viaja al navegador. Si es correcta, se emite una cookie de sesión firmada (válida 12 horas) que el servidor verifica en cada pedido; sin ella no se llega a ver nada del dashboard. Hay además un límite de 5 intentos fallidos cada 15 minutos por IP.

Aun así, tener en cuenta: **es una única contraseña compartida**, no hay usuarios individuales ni registro de quién entró. Como el dashboard muestra datos personales de vecinos (ver §2.3), quién conoce esa clave importa.

### 2.3 Dos fuentes de reclamos en un mismo mapa

El dashboard mezcla en una sola capa:

- **Cargados en el mapa**: los que suben las comunas desde el panel privado.
- **Mandame Tu Reclamo (MTR)**: reclamos que cargan los propios vecinos en un sistema aparte, que vive en otra base de datos y se lee en modo consulta.

Se distinguen a simple vista: los del mapa tienen el borde del marcador sólido, los de MTR punteado. El filtro de Origen permite ver unos, otros o ambos.

Ambas fuentes comparten una **taxonomía unificada de 14 tipos** (Aceras, Alumbrado, Calles, Higiene y Saneamiento, etc.), con un segundo nivel de **subtipo** que conserva el detalle original de cada fuente.

> ⚠️ **Datos personales**: los reclamos de MTR se muestran con **nombre, DNI, teléfono y email completos** del vecino, y sus fotos son accesibles por link sin necesidad de iniciar sesión. Fue una decisión explícita. Los reclamos cargados por las comunas, en cambio, nunca exponen el teléfono del reclamante.

---

## 3. Cómo está armado (stack técnico)

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 + React 19 + TypeScript + Tailwind CSS |
| Mapa | Leaflet / react-leaflet |
| Gráficos | Recharts |
| Backend / datos | Supabase (PostgreSQL + Auth + Storage) |
| Geocodificación | USIG (normalizador oficial de GCABA) con Nominatim (OpenStreetMap) como respaldo |
| Servidor | VPS Hostinger, Ubuntu, gestionado con PM2 y nginx |

**¿Qué es Supabase acá?** Es la base de datos completa del sistema: guarda los reclamos, las sugerencias, los usuarios de cada comuna y los archivos adjuntos (fotos). El proyecto de Supabase se llama **"reclamos"** (referencia `aysbehxlrgtacjdwmhsp`, región São Paulo).

---

## 4. El dato clave: quién puede ver qué (seguridad)

Toda la seguridad real de "quién ve qué" no está en el código de la web sino directamente en la base de datos, con una tecnología de Postgres llamada **Row Level Security (RLS)**. En criollo: aunque alguien manipule la aplicación desde el navegador, **la base de datos igual le va a negar el acceso** a datos que no le corresponden.

La regla, resumida:
- Un usuario de la Comuna 3 solo puede leer y modificar reclamos donde `comuna_id = 3`.
- Al crear un reclamo nuevo, la base exige que el `comuna_id` coincida con la comuna del usuario logueado, y que él mismo figure como creador.
- Existe un rol especial (**master**) que sí puede ver todos los perfiles de usuarios del sistema (para administración).
- Las vistas que alimentan el dashboard público (`reclamos_publicos`, `sugerencias_publicas`) ya vienen "limpias": sin teléfono completo, listas para mostrar a cualquiera.

Solo hay una llave que se salta todas estas reglas: la **Service Role Key**, que se usa exclusivamente desde el servidor (nunca llega al navegador) para tareas administrativas como crear usuarios nuevos o ver sus emails.

---

## 5. Modelo de datos (las tablas principales)

```
auth.users (usuarios de Supabase)
    │
    │ 1 a 1
    ▼
perfiles ──── vincula cada usuario con su comuna (1 a 15) y sus permisos
    │
    │ el usuario crea...
    ▼
reclamos ──────< reclamo_archivos >────── sugerencias
(problemas a       (fotos/PDF                (ideas/propuestas
 resolver)          adjuntos)                 de mejora)
```

- **`reclamos`**: tipo de problema (y `subtipo`, el detalle), urgencia, descripción, datos de contacto, dirección (texto y normalizada), coordenadas, estado (`nuevo` → `en_proceso` → `resuelto`/`descartado`), comuna, quién lo cargó y cuándo.
- **`sugerencias`**: estructura casi idéntica, pero con sus propios estados (`nuevo` → `en_evaluacion` → `aprobado`/`rechazado`).
- **`perfiles`**: qué comuna es cada usuario, si puede crear sub-usuarios (`can_create_users`) y si es administrador global (`is_master`).
- **`tipos_reclamo` / `tipos_sugerencia`**: catálogos de categorías habilitadas (bache, alumbrado, arbolado, etc.).
- **`reclamo_archivos`**: fotos y documentos adjuntos, compartida entre reclamos y sugerencias.
- **`circuitos`** y **`problemas_circuito`**: capa adicional con los 167 circuitos electorales oficiales de la Ciudad (con su geometría en el mapa) y problemas puntuales cargados por circuito.

---

## 6. Cómo se carga un reclamo, paso a paso

1. El usuario de la comuna escribe la dirección en el formulario.
2. A medida que tipea, el sistema consulta al normalizador oficial de la Ciudad (**USIG**) y sugiere direcciones válidas dentro de CABA.
3. Si USIG falla, se intenta con **Nominatim** (OpenStreetMap) como respaldo.
4. No se puede guardar el reclamo hasta que la dirección quede geocodificada (con lat/lng) — salvo que todos los intentos fallen, en cuyo caso se guarda igual pero sin coordenadas (aparece marcado como "sin geo" y no sale en el mapa).
5. Si el usuario adjunta fotos, se suben a un espacio de almacenamiento (Supabase Storage) y quedan asociadas al reclamo.
6. El reclamo queda visible al instante en el panel de esa comuna, y en el dashboard público al actualizarse (cada 60 segundos).

---

## 7. Dónde vive y cómo se actualiza

- **Repositorio de código:** GitHub, `Facunfer/reclamos-caba`.
- **Servidor:** VPS Hostinger (IP `145.223.92.253`), corriendo en el puerto **3001** (para no chocar con la otra app "mapa" que usa el 3000).
- **Dominio:** `reclamos.alianzalalibertadavanzacaba.com`.
- **Proceso:** administrado con **PM2** (se reinicia solo si el servidor reinicia).
- Para publicar un cambio: se baja el código nuevo (`git pull`), se recompila (`npm run build` — obligatorio, Next.js no sirve el código sin compilar) y se reinicia el proceso con PM2.
- Si el cambio incluye modificaciones a la base de datos, hay que correr manualmente el script SQL correspondiente en el editor SQL de Supabase (no se aplica solo).

---

## 8. Puntos débiles conocidos (para tener en el radar)

1. **Datos personales expuestos en `/public`** — los reclamos de MTR se muestran con nombre, DNI, teléfono y email completos, y sus fotos abren por link sin login. Detrás hay una sola contraseña compartida, sin usuarios individuales ni registro de accesos. Es la decisión tomada, pero conviene revisarla si el círculo de gente con la clave se agranda.
2. **Una sola contraseña para todo el dashboard** — no se puede dar de baja el acceso a una persona sin cambiársela a todas.
3. **El panel no permite cambiar el estado de un reclamo desde la interfaz** todavía (la base ya lo permite, falta el botón).
4. **Las fotos de los reclamos comunales están en un bucket público** — cualquiera con el link directo puede verlas.
5. **Las contraseñas de prueba de las 15 comunas son `123456`** — hay que rotarlas antes de considerar el sistema en uso "real" y seguro.
6. **En el mapa, con 14 tipos hay colores que no se distinguen entre sí** (y bastantes más para personas daltónicas). Está medido y asumido: por eso el tipo siempre se puede leer en el popup, la leyenda y el filtro.
7. **Estados sin unificar entre fuentes** — MTR usa `RECIBIDO/ELEVADO/RECHAZADO`, el sistema propio `nuevo/en_proceso/resuelto/descartado`. Se muestran tal cual.
8. Hay un error de TypeScript pendiente sin resolver en el script de alta de usuarios (`scripts/seed-users.ts`), y el último intento de cargar contraseñas para las 15 comunas falló (Supabase exige mínimo 6 caracteres y el script mandó una más corta).

---

## 9. Mapa de accesos rápido

| Quiero... | Voy a... |
|---|---|
| Ver el mapa público de reclamos | `https://reclamos.alianzalalibertadavanzacaba.com/public` |
| Cargar un reclamo como comuna | `.../login` → entrar con `cN@reclamos.gob.ar` → `.../panel/nuevo` |
| Ver el directorio de equipos por comuna | `.../public/comunas` |
| Ver el mapa de circuitos electorales | `.../public/circuitos` |
| Administrar la base de datos | Panel de Supabase, proyecto **"reclamos"** |
