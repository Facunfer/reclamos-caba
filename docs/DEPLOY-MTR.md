# Deploy — Integración "Mandame Tu Reclamo" (MTR)

Procedimiento para publicar la integración de MTR y el nuevo gate server-side
de `/public` en el VPS. Complementa a `DEPLOY.md` (que sigue vigente para todo
lo demás).

---

## 1. Orden de ejecución

```bash
# 1. Traer el código
cd /root/reclamos
git pull origin main
npm install

# 2. Variables de entorno nuevas (ver §2) — SIN esto la app no levanta bien
nano /root/reclamos/.env.local

# 3. Migraciones SQL (ver §3) — correr EN ORDEN en el SQL Editor de Supabase

# 4. Compilar y reiniciar
npm run build
pm2 restart reclamos
pm2 logs reclamos --lines 50
```

> El paso 3 va **antes** del build: el dashboard consulta `subtipo`, que no
> existe hasta correr la migración 009.

---

## 2. Variables de entorno nuevas

Agregar a `/root/reclamos/.env.local`:

```bash
# Gate de /public — ahora se valida SERVER-SIDE. Ojo: ya NO llevan NEXT_PUBLIC_.
MASTER_USER=<usuario-fuerte>
MASTER_PASS=<contraseña-fuerte>

# Secreto para firmar la cookie de sesión (HMAC-SHA256).
# Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PUBLIC_SESSION_SECRET=<64-hex-aleatorio>

# Mandame Tu Reclamo — proyecto Supabase externo. service_role: server-only.
MTR_SUPABASE_URL=https://rzqbrlbamgeacxqwkzxp.supabase.co
MTR_SUPABASE_SERVICE_KEY=<service-role-key-de-mtr>
```

**Borrar** las viejas `NEXT_PUBLIC_MASTER_USER` / `NEXT_PUBLIC_MASTER_PASS`: si
quedan, no hacen nada (el código ya no las lee), pero siguen expuestas en el
bundle del navegador.

Verificar que ningún secreto quedó en el cliente después del build:

```bash
grep -r "MTR_SUPABASE_SERVICE_KEY\|MASTER_PASS" .next/static && echo "FUGA" || echo "OK"
```

---

## 3. Migraciones SQL (en orden, en el SQL Editor de Supabase)

| # | Archivo | Qué hace |
|---|---|---|
| 009 | `supabase/009_taxonomia_unificada.sql` | Agrega `subtipo`, backfill de las 177 filas, reasigna `tipo_reclamo` a las 14 categorías unificadas, actualiza el catálogo |
| 010 | `supabase/010_reclamos_publicos_subtipo.sql` | Expone `subtipo` en la vista `reclamos_publicos` |

Ambas son idempotentes y transaccionales. Rollback de la 009:
`supabase/009_taxonomia_unificada_rollback.sql`.

### Verificación post-migración

```sql
-- 177 filas, cero nulos
SELECT count(*) AS total,
       count(*) FILTER (WHERE tipo_reclamo IS NULL) AS tipo_nulo,
       count(*) FILTER (WHERE subtipo IS NULL) AS subtipo_nulo
FROM public.reclamos;

-- 14 categorías activas
SELECT nombre FROM public.tipos_reclamo WHERE activo = true ORDER BY nombre;

-- Distribución (comparar contra el "antes")
SELECT tipo_reclamo, subtipo, count(*) FROM public.reclamos GROUP BY 1,2 ORDER BY 1,2;
```

**Estado esperado tras la migración** (ya aplicada en producción el 2026-08-25):

| tipo | subtipo | filas |
|---|---|---|
| ACERAS | VEREDAS | 21 |
| ALUMBRADO | ALUMBRADO | 10 |
| ARBOLES/PLAZAS/PARQUES | ARBOLADO | 11 |
| CALLES | BACHES | 4 |
| HIGIENE Y SANEAMIENTO | AGUA/CLOACAS | 9 |
| HIGIENE Y SANEAMIENTO | BASURA | 61 |
| OTROS | OTROS | 25 |
| RUIDOS | RUIDOS | 2 |
| SEGURIDAD | SEGURIDAD | 26 |
| SEMAFOROS Y TRANSPORTE | TRANSPORTE | 8 |

---

## 4. Decisiones tomadas durante la integración

### Taxonomía: 14 categorías, no 12
Al introspeccionar aparecieron dos casos fuera del mapeo original:
- **`SEMAFOROS` y `TRANSITO`** son grupos separados en MTR → se unificaron en
  `SEMAFOROS Y TRANSPORTE`.
- **`OTROS` (25 reclamos) y `RUIDOS` (2)** existían en el sistema propio y no
  tenían equivalente → se agregaron como categorías 13 y 14 para no forzar ni
  perder esos reclamos.

Los tipos viejos reemplazados **no se borran**: quedan `activo = false`, para
no romper el histórico ni la FK.

### Subtipo: columna de texto libre, sin catálogo propio
`subtipo` es `text` sin FK. Motivo: los subtipos de MTR son suyos y pueden
cambiar sin aviso; una FK obligaría a sincronizar catálogos entre dos bases
de dueños distintos. El form del panel no cambió — sigue cargando solo `tipo`,
y el `subtipo` de los reclamos nuevos queda `NULL` hasta que se decida
exponerlo en la UI de carga.

### Datos personales en `/public`
Los reclamos de MTR se muestran con **DNI, teléfono y email completos**, sin
enmascarar. Decisión explícita del dueño del producto, tomada con el riesgo
señalado: `/public` protege con **una sola contraseña compartida**, no con
cuentas individuales, y no hay auditoría de quién accede. Los reclamos nativos
**no** cambiaron: la vista `reclamos_publicos` nunca expuso el teléfono del
reclamante y sigue sin hacerlo.

### Colores del mapa: 14 categorías, con una limitación medida
El mapa colorea por tipo con una paleta documentada en `src/lib/paletaTipos.ts`
(reemplaza al hash aleatorio anterior). Medido con el validador de la
metodología de dataviz sobre la superficie negra del dashboard:

- **Pares adyacentes** (leyenda, barras apiladas): **todos los checks pasan**
  (CVD ΔE 11.3, visión normal ΔE 16.9, contraste 14/14 ≥ 3:1).
- **Todos los pares** (el caso real del mapa, donde dos puntos cualesquiera
  pueden quedar contiguos): **falla, y es inevitable con 14 categorías** — el
  peor par cae a ΔE 1.1 bajo protanopía y ΔE 6.0 en visión normal.

Es decir: **hay pares de tipos que no se distinguen solo por color**. Se
aceptó a cambio de mostrar las 14 categorías. Por eso el color nunca es el
único canal de identidad, y estas tres mitigaciones son obligatorias:
1. el popup nombra tipo y subtipo en texto;
2. la leyenda del mapa lista las categorías presentes;
3. el filtro de Tipo permite aislar una categoría.

**No quitar ninguna sin revisar esta decisión.** Si en uso real la confusión
molesta, la salida es reducir categorías en el mapa (top N + "otras"), no
buscar otra paleta: con 14 no existe uno que pase.

---

### Fotos de MTR: proxy abierto, sin tocar su bucket
El bucket `reclamos-fotos` de MTR es **privado** (el nuestro es público). Para
mostrar sus 341 fotos en el mapa y el CSV se agregó
`src/app/api/fotos-mtr/[...path]/route.ts`: baja el binario server-side con la
service_role y lo devuelve. Ventajas sobre las alternativas:

- **No se tocó el bucket de MTR.** Hacerlo público sería un cambio en un
  proyecto ajeno que expone fotos de vecinos para siempre — requiere permiso
  del dueño de esa base, no de este repo.
- **No usa URLs firmadas.** Expiran, y los links del CSV quedarían muertos.
  Las del proxy son estables.

La ruta está **deliberadamente fuera de `/api/public/*`**, así que el
middleware NO la protege: los links del CSV abren sin login, igual que las
fotos de los reclamos nativos. Decisión explícita del dueño del producto.
Para cerrarlas, basta con moverla a `/api/public/fotos-mtr/` — el middleware
la toma automáticamente.

**Defensa contra proxy arbitrario:** la ruta solo acepta paths con la forma
`{uuid}/{archivo}` y extensiones de imagen/PDF. Sin esa validación, cualquiera
podría pedir objetos arbitrarios del storage de MTR firmados con la
service_role. Verificado: `../../secret.jpg` → 404, `no-es-uuid/1.jpg` → 400,
`.exe` → 400, `..%2F..%2Fetc%2Fpasswd` → 400, uuid inexistente → 404.
Las respuestas se cachean con `max-age=31536000, immutable`.

---

## 5. Pendientes conocidos

- **Estados sin unificar**: MTR usa `RECIBIDO/ELEVADO/RECHAZADO...` y el sistema
  propio `nuevo/en_proceso/resuelto/descartado`. Se muestran tal cual, sin
  normalizar y sin filtro de estado unificado.
- **Urgencia**: MTR no tiene el campo. Esos reclamos aparecen como "Sin dato",
  que es una opción explícita del filtro.
- **Rate limit en memoria**: `src/lib/rateLimit.ts` vive por proceso y se
  resetea al reiniciar. Alcanza con PM2 en modo fork (una sola instancia); si
  algún día se escala a cluster, hay que moverlo a un store compartido.
- **Error preexistente**: `scripts/seed-users.ts:70` tiene un error de
  TypeScript anterior a este trabajo; no se tocó.

---

## 6. Troubleshooting

| Síntoma | Chequeo |
|---|---|
| `/public` redirige a login en loop | Falta `PUBLIC_SESSION_SECRET`, o cambió (rotarlo invalida las sesiones activas) |
| "Credenciales incorrectas" con la clave correcta | ¿Definiste `MASTER_USER`/`MASTER_PASS` **sin** el prefijo `NEXT_PUBLIC_`? |
| Aviso "no se pudieron cargar los reclamos de MTR" | `pm2 logs reclamos` → revisar `[reclamosUnificados] Error consultando MTR`. La app no se rompe: sigue mostrando los nativos |
| El filtro de Subtipo aparece vacío | ¿Corriste la migración 010? Sin ella la vista no expone `subtipo` |
| Demasiados intentos (429) | Rate limit: 5 fallidos por IP cada 15 min. `pm2 restart reclamos` lo limpia |
