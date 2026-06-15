# Deploy — Reclamos CABA (VPS Hostinger)

Guía de despliegue y **actualización** en el VPS (Ubuntu 24.04, Node 20, nginx, PM2).
Convive con las otras apps del servidor (`mapa` en :3000, `portal` Streamlit en :8501)
sin afectarlas. Esta app usa el puerto **3001**.

- **Repo:** https://github.com/Facunfer/reclamos-caba.git
- **Ruta en el server:** `/root/reclamos`
- **Proceso PM2:** `reclamos` (puerto 3001)
- **Dominio sugerido:** `reclamos.alianzalalibertadavanzacaba.com`
- **IP del VPS:** `145.223.92.253`

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
NEXT_PUBLIC_MASTER_USER=<usuario-master-fuerte>
NEXT_PUBLIC_MASTER_PASS=<contraseña-fuerte>
EOF
chmod 600 /root/reclamos/.env.local
```

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
Abrí `https://reclamos.alianzalalibertadavanzacaba.com` →
- `/` redirige a `/public` (gate MASTER).
- `/login` permite entrar al panel comunal.

---

## 🩺 Troubleshooting

| Síntoma | Chequeo |
|---|---|
| 502 Bad Gateway | `pm2 logs reclamos` — la app no levantó (faltan envs o falló el build) |
| Panel/circuitos fallan | Faltan/erróneas las `SUPABASE_*` en `.env.local` → recargá y `pm2 restart reclamos` |
| Cambios no se ven | ¿Corriste `npm run build` antes del `pm2 restart`? |
| Build OOM | Agregar swap (paso 3) |
| Puerto ocupado | `sudo ss -ltnp | grep 3001` — elegí otro puerto y actualizá `ecosystem.config.js` + nginx |
