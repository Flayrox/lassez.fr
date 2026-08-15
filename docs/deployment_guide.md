# 🚀 Guide de Déploiement Lassez.fr

Le déploiement est **unifié sur un seul pipeline** : GitHub Actions → VPS → PM2. Plusieurs anciens systèmes (Docker Compose, `full_deploy.cjs` multi-environnements) ont été supprimés.

## 📦 Pipeline Canonique (Automatique)

Un push sur la branche `main` déclenche le workflow `.github/workflows/deploy.yml` :

1. **Synchronisation** : le dépôt est tiré sur le VPS (`/var/www/lassez-repo`).
2. **Copie** : rsync vers l'environnement unique `/var/www/lassez-api` (le `.env` local du VPS est conservé).
3. **Build** : `npm ci` → `npm run payload:migrate` → `npm run build`.
4. **Redémarrage** : `pm2 startOrReload ecosystem.config.cjs --update-env` + `pm2 save`.

> L'IP du VPS et la clé SSH sont configurées dans les secrets GitHub (`VPS_SSH_KEY`).

## 🛠️ Déploiement Manuel (Fallback)

En cas de besoin, le script `scripts/deploy_vps_unified.cjs` reproduit le même flux :

```bash
VPS_HOST=178.104.197.3 VPS_USER=root VPS_SSH_KEY="$(cat ~/.ssh/id_ed25519)" npm run deploy:vps
```

Variables utilisées : `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_REMOTE_DIR` (défaut `/var/www/lassez-prod`), `VPS_GIT_BRANCH` (défaut `main`).

## 📦 Configuration des Services (PM2)

Un seul environnement `/var/www/lassez-api` fait tourner 4 processus (fichier `ecosystem.config.cjs`) :

| Nom | Port | Description |
| :--- | :--- | :--- |
| `lassez-front` | **3000** | Le site public (lassez.fr) |
| `lassez-api` | **3001** | L'API Payload et l'Admin (api.lassez.fr) |
| `lassez-studio` | **3002** | Interface de curation, d'automatisation & de workflow (studio.lassez.fr) |
| `lassez-daemon` | **3005** | Daemon principal Radar (ingestion, rédaction, publisher) |

> ⚠️ **Migration PM2 (une seule fois)** : si d'anciens processus nommés `radar-api`, `radar-front`, `radar-studio` ou `radar-daemon` tournent encore sur le VPS, supprimez-les pour libérer les ports :
> ```bash
> pm2 delete radar-api radar-front radar-studio radar-daemon
> pm2 save
> ```
> Le workflow GitHub Actions le fait automatiquement à chaque déploiement (`pm2 delete ... || true`).

### Commandes Utiles :
- **Voir le statut** : `pm2 list`
- **Voir les logs** : `pm2 logs [nom]`
- **Redémarrer un service** : `pm2 restart [nom]`

## 🔐 Gestion des Rôles (RBAC)

Les permissions sont gérées via le champ `roles` dans la collection **Auteurs** (Payload).

- **Admin** : Accès total.
- **Éditeur** : Peut modifier tous les articles et révélations.
- **Auteur** : Ne peut modifier que ses **propres** créations.

### Donner les droits Admin à un utilisateur :
```bash
# Nécessite DATABASE_URL dans l'environnement (cf. .env)
node scripts/grant_admin.cjs email@exemple.com
```

## ⚠️ Notes Techniques
- **Base de Données** : Payload utilise Supabase (Postgres). Les migrations sont appliquées automatiquement par le workflow de déploiement (`npm run payload:migrate`).
- **Base Radar** : le daemon écrit désormais dans Payload (Postgres) — plus de SQLite. Les collections dédiées (`signals`, `sources`, `publications`, `seen-urls`, `taxonomy-templates`, `logs`) et le global `radar-settings` remplacent l'ancienne base Prisma.
- **Clé SSH** : le déploiement GitHub Actions utilise le secret `VPS_SSH_KEY` ; les scripts manuels utilisent `~/.ssh/id_ed25519`.

## 🔄 Migration Radar (une seule fois, avant de basculer le daemon)

1. Appliquer le schéma : `npm run payload:migrate` (déjà fait par le workflow).
2. Créer le compte bot admin : `npx tsx payload/create-bot.ts` (lit `PAYLOAD_BOT_EMAIL` / `PAYLOAD_BOT_PASSWORD`).
3. Importer les données SQLite → Payload : `node scripts/migrate_radar_to_payload.cjs`.
4. Vérifier que `radar_lassez/.env` (ou le `.env` racine) contient `PAYLOAD_API_URL`, `PAYLOAD_BOT_EMAIL` et `PAYLOAD_BOT_PASSWORD` : le daemon les charge lui-même au démarrage.
