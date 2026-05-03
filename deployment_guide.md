# 🚀 Guide de Déploiement Lassez.fr

Ce guide explique comment utiliser les outils de déploiement pour mettre à jour le site, l'API et les daemons sur le VPS.

## 📦 Outil de Déploiement Unifié
Le script `full_deploy.cjs` permet de réaliser toutes les étapes en une seule commande :
1. **Git** : `add`, `commit` et `push` vers GitHub.
2. **Archive** : Compression du code local (en excluant les dossiers inutiles).
3. **Upload** : Envoi de l'archive vers le VPS via SSH.
4. **Build & Migrate** : Reconstruction des 3 instances (Front, API, Studio) et exécution des migrations.
5. **Restart** : Redémarrage de tous les processus PM2.

### Utilisation :
```bash
node full_deploy.cjs "Message de commit"
```
*Si aucun message n'est fourni, un message automatique avec horodatage sera utilisé.*

---

## 🛠️ Configuration des Services (PM2)

Le projet est divisé en 5 processus principaux sur le VPS :

| Nom | Port | Description |
| :--- | :--- | :--- |
| `radar-front` | **3000** | Le site public (lassez.fr) |
| `radar-api` | **3001** | L'API Payload et l'Admin (api.lassez.fr) |
| `radar-studio` | **3002** | L'interface de curation (studio.lassez.fr) |
| `radar-daemon` | **3005** | Daemon principal (Publisher, Élections, Heartbeat) |
| `radar-daemon-rss` | **3006** | Daemon de scan RSS et Telegram |

### Commandes Utiles :
- **Voir le statut** : `pm2 list`
- **Voir les logs** : `pm2 logs [nom]`
- **Redémarrer un service** : `pm2 restart [nom]`

---

## 🔐 Gestion des Rôles (RBAC)

Les permissions sont gérées via le champ `roles` dans la collection **Auteurs**.

- **Admin** : Accès total.
- **Éditeur** : Peut modifier tous les articles et révélations.
- **Auteur** : Ne peut modifier que ses **propres** créations.

### Donner les droits Admin à un utilisateur :
Si un utilisateur perd ses accès, vous pouvez utiliser le script local :
```bash
# Modifier l'email dans le script grant_admin.cjs si besoin
node grant_admin.cjs
```

---

## ⚠️ Notes Techniques
- **Base de Données** : Le projet utilise Supabase (Postgres). Les migrations doivent être effectuées via `npm run payload:migrate` (automatisé dans le script de déploiement).
- **Daemons** : Ils possèdent chacun un port "dummy" (3005 et 3006) pour assurer leur maintien en vie sur certaines infrastructures d'hébergement.
- **Clé SSH** : Le déploiement nécessite que votre clé privée soit située dans `~/.ssh/id_ed25519`.
