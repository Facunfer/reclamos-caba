# Deploy — Reclamos CABA (VPS Hostinger)

Guía de despliegue y **actualización** en el VPS (Ubuntu 24.04, Node 20, nginx, PM2).
Convive con las otras apps del servidor (`mapa` en :3000, `portal` Streamlit en :8501)
sin afectarlas. Esta app usa el puerto **3001**.

- **Repo:** https://github.com/Facunfer/reclamos-caba.git
- **Ruta en el server:** `/root/reclamos`
- **Proceso PM2:** `reclamos` (puerto 3001)
- **Dominio propio:** `mapa.alianzalalibertadavanzacaba.com`
- **También accesible desde:** `portal.alianzalalibertadavanzacaba.com/reclamos`
  (mismo proceso, servido adentro del Portal Territorial — ver más abajo)
- **IP del VPS:** `145.223.92.253`

> ⚠️ **`reclamos.alianzalalibertadavanzacaba.com` no existe.** Versiones
> anteriores de este documento lo daban por hecho como "dominio sugerido", pero
> nunca se creó el registro DNS: hoy no resuelve. La app quedó viviendo en
> `mapa.`, que era el dominio de la app anterior de ese nombre.

> ⚠️ **Todas las rutas llevan el prefijo `/reclamos`** desde la integración con
> el Portal. El login del panel es `/reclamos/login`, no `/login`. Las URLs
> viejas redirigen con 301, así que lo que la gente tenga guardado sigue
> funcionando.

---

## 🔄 Actualizar el sitio (lo más común)

Cuando hay cambios nuevos en GitHub:

```bash
cd /root/reclamos
git pull origin main
npm install            # solo si cambió package.json, no molesta correrlo siempre
npm run build          # OBLIGATORIO: Next se sirve compilado, no alcanza con copiar archivos
pm2 restart reclamos
pm2 logs reclamos --lines 50   # verificar que levantó sin errores
```

> Si tocaste la base de datos, aplicá también las migraciones nuevas de `supabase/`
> en el **SQL Editor** de Supabase (en orden).

---

## 🚀 Primer deploy (una sola vez)

### 0. DNS
En el panel donde administrás `alianzalalibertadavanzacaba.com`, creá un registro:

```
Tipo: A    Nombre: reclamos    Valor: 145.223.92.253    TTL: por defecto
```

Esperá a que resuelva (`ping reclamos.alianzalalibertadavanzacaba.com` debe devolver la IP).

### 1. Clonar
```bash
cd /root
git clone https://github.com/Facunfer/reclamos-caba.git reclamos
cd reclamos
```

### 2. Variables de entorno
Creá `/root/reclamos/.env.local` con los valores reales (los mismos que usás localmente
para Supabase; el proyecto Supabase es el mismo de producción):

```bash
cat > /root/reclamos/.env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://aysbehxlrgtacjdwmhsp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
MASTER_USER=<usuario-master-fuerte>
MASTER_PASS=<contraseña-fuerte>
PUBLIC_SESSION_SECRET=<generar-con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
EOF
chmod 600 /root/reclamos/.env.local
```

> Desde la migración del gate de `/public` a validación server-side, estas variables
> **no** llevan prefijo `NEXT_PUBLIC_` (si lo llevan, la app cae de nuevo en el defecto
> inseguro anterior). Ver `DOCUMENTACION.md` §5.2.

> `.env.local` NO está en git (gitignored). Nunca lo subas.

### 3. Instalar y compilar
```bash
npm install
npm run build
```
Si el build se queda sin memoria (OOM) con `mapa` corriendo, agregá swap temporal:
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

### 4. Levantar con PM2 (puerto 3001)
```bash
cd /root/reclamos
pm2 start ecosystem.config.js
pm2 save            # persiste el proceso para que reviva tras reinicios
pm2 list            # debe verse 'reclamos' online junto a 'mapa'
```

### 5. nginx (reverse proxy del dominio → :3001)
```bash
sudo tee /etc/nginx/sites-available/reclamos > /dev/null <<'EOF'
server {
    listen 80;
    server_name reclamos.alianzalalibertadavanzacaba.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/reclamos /etc/nginx/sites-enabled/reclamos
sudo nginx -t          # debe decir "syntax is ok" / "test is successful"
sudo systemctl reload nginx
```

### 6. SSL (HTTPS con Certbot)
```bash
sudo certbot --nginx -d reclamos.alianzalalibertadavanzacaba.com
```
Certbot reescribe el bloque nginx agregando el `listen 443 ssl` y el redirect 80→443
(igual que en `mapa`).

### 7. Verificar
Abrí `https://mapa.alianzalalibertadavanzacaba.com/reclamos` →
- `/reclamos` redirige a `/reclamos/public` (gate MASTER).
- `/reclamos/login` permite entrar al panel comunal.
- `https://mapa.alianzalalibertadavanzacaba.com/login` redirige con 301 al prefijo.

---

## 🔗 Integración con el Portal Territorial

Esta app se sirve **también** bajo `/reclamos` del origen del Portal, y el botón
del Portal abre sesión sin pedir contraseña. Detalle completo en
`DOCUMENTACION.md` §11. Lo que hace falta en el servidor:

### A. Variables de entorno nuevas (`/root/reclamos/.env.local`)

```bash
# Tiene que ser EXACTAMENTE el mismo string que en el .env.local del Portal.
# Generar UNA vez y pegarlo en los dos:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SSO_BRIDGE_SECRET=<64-hex>

# A dónde vuelve el botón "← Portal" del panel.
NEXT_PUBLIC_PORTAL_URL=https://portal.alianzalalibertadavanzacaba.com/
```

Si `SSO_BRIDGE_SECRET` falta o difiere entre los dos lados, el SSO queda caído
—el botón deposita a la gente en `/reclamos/login?sso=invalido`— pero el login
manual con `cN@reclamos.gob.ar` sigue funcionando. Degrada, no bloquea.

### B. Migración de la base

Correr `supabase/011_sso_accesos.sql` en el SQL Editor del proyecto **reclamos**.
Crea la tabla del registro de accesos. Es idempotente.

Si no se corre, el SSO igual funciona: cada canje deja un error en `pm2 logs
reclamos` y no se guarda el registro. Se eligió que la auditoría falle en
silencio antes que dejar afuera a las 15 comunas por una tabla faltante.

### C. nginx

Los dos bloques `location` están en `deploy/nginx-reclamos-en-portal.conf` del
repo **`portal-crm`**, con las instrucciones y la verificación. Uno va en el
vhost del Portal y otro en el de `mapa.`.

**Antes de tocar nginx, verificar los nombres reales** — la documentación de los
dos proyectos se contradice sobre qué puerto usa cada app:

```bash
ss -ltnp | grep -E ':(3000|3001|3002|3003|8501)'
pm2 list
ls -l /etc/nginx/sites-enabled/
```

Y `nginx -t` antes de cualquier `reload`: este nginx sirve también al Portal, la
consola y la app Streamlit.

### D. Orden del despliegue

El `basePath` y el proxy tienen que llegar juntos, o hay una ventana en la que
la app no responde en ninguna URL:

1. nginx primero (los `location` nuevos no rompen nada mientras la app siga
   respondiendo en la raíz — el `proxy_pass` a `/reclamos/` va a dar 404 y listo).
2. `nginx -t && systemctl reload nginx`.
3. Recién ahí: `git pull`, `npm run build`, `pm2 restart reclamos` acá.
4. Y el Portal: `git pull`, `npm run build`, `pm2 restart` del proceso del CRM.

**Rollback:** comentar los dos bloques de nginx, sacar `basePath` de
`next.config.ts`, rebuild y restart. El Portal no necesita rollback: su único
cambio del lado del usuario es el `href` del botón, que sin el proxy da 404 en
vez de llevar a otro lado.

---

## 🩺 Troubleshooting

| Síntoma | Chequeo |
|---|---|
| 502 Bad Gateway | `pm2 logs reclamos` — la app no levantó (faltan envs o falló el build) |
| Panel/circuitos fallan | Faltan/erróneas las `SUPABASE_*` en `.env.local` → recargá y `pm2 restart reclamos` |
| Cambios no se ven | ¿Corriste `npm run build` antes del `pm2 restart`? |
| Build OOM | Agregar swap (paso 3) |
| Puerto ocupado | `sudo ss -ltnp | grep 3001` — elegí otro puerto y actualizá `ecosystem.config.js` + nginx |
| El botón del Portal cae en `?sso=invalido` | `SSO_BRIDGE_SECRET` distinto entre los dos `.env.local`, o falta en uno. `pm2 logs reclamos` dice el motivo exacto |
| El botón del Portal cae en `?sso=expirado` | El pase dura 60s. Si pasa siempre, revisá que los relojes de los dos procesos estén en hora (`timedatectl`) |
| SSO entra pero no queda registro | Falta correr `supabase/011_sso_accesos.sql`. Está en los logs de PM2 |
| Un redirect manda a `/login` sin el prefijo | El build se hizo sin `basePath`. `npm run build` de nuevo y `pm2 restart` |
