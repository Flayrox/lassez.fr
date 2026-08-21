# 🚀 Déploiement L'Assez — Front clean

Pipeline unique : GitHub Actions → VPS → PM2 (1 seul process).

1. **Sync** : `git pull` sur `/var/www/lassez-repo`
2. **Copy** : rsync → `/var/www/lassez` (`.env` conservé)
3. **Build** : `npm ci && npm run build`
4. **Restart** : `pm2 startOrReload ecosystem.config.cjs --update-env && pm2 save`

Fallback manuel : `VPS_HOST=... VPS_USER=root npm run deploy:vps` (script `scripts/deploy_vps_unified.cjs`)

## PM2

| Nom | Port | Description |
| :--- | :--- | :--- |
| `lassez-front` | **3000** | Site public (lassez.fr) |

Anciens services supprimés : `lassez-api` (3001), `lassez-studio` (3002), `lassez-daemon` (3005)

```bash
pm2 list
pm2 logs lassez-front
pm2 restart lassez-front
```

## Notes

- Plus de Payload / DB Supabase en front pour l'instant. Le futur provider sera branché dans `lib/data.ts`.
- `data/radar.db` (élections) conservé en local si besoin, mais le front tourne sans (fallback).
- Secrets GitHub : `VPS_SSH_KEY` + `VPS_HOST`.
