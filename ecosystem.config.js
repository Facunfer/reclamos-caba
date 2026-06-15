// PM2 — Reclamos CABA
// Replica el patrón de la app `mapa` (npm start = next start) en un puerto propio.
// Uso: pm2 start ecosystem.config.js  (desde /root/reclamos)
module.exports = {
  apps: [
    {
      name: "reclamos",
      script: "npm",
      args: "start",
      cwd: "/root/reclamos",
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3001, // mapa usa 3000; reclamos usa 3001
      },
    },
  ],
};
