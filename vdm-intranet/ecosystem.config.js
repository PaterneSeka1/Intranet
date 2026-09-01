/**
 * Configuration PM2 — VDM Intranet (API NestJS + Frontend Next.js).
 *
 * Utilisation (depuis la racine du dépôt, après npm run build:api / npm run build:web) :
 *   pm2 start ecosystem.config.js
 *   pm2 save                        # persiste la liste pour un redémarrage après reboot VPS
 *   pm2 startup                     # génère le service système (à exécuter une seule fois)
 *
 * Les deux apps lisent leurs variables d'environnement depuis le .env racine :
 *   - vdm-api : ConfigModule NestJS (envFilePath: ['../../.env', '.env'], voir app.module.ts).
 *   - vdm-web : apps/web/.env.production.local, généré par scripts/copy-web-env.js (déclenché
 *     automatiquement avant npm run build:web via le hook npm prebuild:web).
 * Aucun secret n'est donc nécessaire dans ce fichier — il est committé volontairement.
 *
 * vdm-api tourne en instance unique (fork, pas cluster) : le rate-limiting (ThrottlerModule), le
 * cache de l'intégration Congés (LeaveSyncService) et la diffusion Socket.IO (annonces,
 * notifications) sont tous en mémoire process — un mode cluster sans adaptateur partagé (ex.
 * Redis) donnerait un état incohérent entre workers. À revisiter si la charge l'exige un jour.
 *
 * Port vdm-web forcé à 3003 (au lieu du 3000 par défaut de Next.js) : ce VPS héberge déjà
 * d'autres apps sur 3000/3001/3002 (rhvedem, ticketing, decryptage) — voir aussi API_PORT=3004
 * dans le .env racine et deployment/nginx/vdm-intranet.conf, qui doivent rester cohérents.
 */
module.exports = {
  apps: [
    {
      name: 'vdm-api',
      cwd: './apps/api',
      script: 'dist/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '../pm2-logs/api-error.log',
      out_file: '../pm2-logs/api-out.log',
      time: true,
    },
    {
      name: 'vdm-web',
      cwd: './apps/web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3003',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: '../pm2-logs/web-error.log',
      out_file: '../pm2-logs/web-out.log',
      time: true,
    },
  ],
}
