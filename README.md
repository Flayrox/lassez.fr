# L'Assez — Plateforme Média & Radar d'Investigation

**L'Assez** est un média d'investigation indépendant (lassez.fr). Ce monorepo contient la plateforme complète : le site public, le cockpit de rédaction/automatisation (Studio), et le daemon Radar qui aspire, analyse, rédige et publie du contenu via IA.

## 🏗️ Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Front public (lassez.fr)   │     │  Studio (studio.lassez.fr)   │
│  Next.js App Router + RSC   │     │  Radar-admin : dashboard,    │
│  composants "papier"        │     │  settings, daemon, flow,     │
│                             │     │  templates, network, lab     │
└──────────┬──────────────────┘     └──────────────┬───────────────┘
           │                                       │
           ▼                                       ▼
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Payload CMS (api.lassez.fr)│     │  Daemon Radar (radar_lassez/)│
│  collections : posts,       │     │  Pipeline 7 nœuds :          │
│  revelations, lessons,      │     │  ingestion → dedup →         │
│  categories, tags, authors, │     │  research → editorial →      │
│  media + globals            │     │  validator → media →         │
│  (Postgres / Supabase)      │     │  publisher                   │
└─────────────────────────────┘     └──────────────┬───────────────┘
                                                   ▼
                              SQLite (prisma/radar.db) : settings,
                              topics, publications, sources, logs
```

### Les 4 blocs

1. **Front public** (`app/(frontend)/` + `components/`) — le site éditorial : home, articles, révélations, enquêtes, podcasts, comprendre (leçons), élections live, recherche, soutenir. Pages RSC servies par Payload, ISR avec revalidation instantanée, SEO auto-généré (Gemini).

2. **Studio / Radar-admin** (`app/(frontend)/radar-admin/` + `app/(studio)/`) — cockpit de contrôle : settings (sources RSS/Telegram/Google News, taxonomies, diffusion Discord/X/Bluesky/Mastodon, prompts IA), contrôle du daemon (PM2), éditeur de templates de visualisation (FFmpeg.wasm), graphe de pipeline, réseau, lab. Protégé par `proxy.ts` (middleware Next.js : session HMAC, rate limiting, RBAC par route).

3. **Payload CMS** (`payload/`) — back-office éditorial : collections `posts`, `revelations`, `lessons` (+ `categories`, `tags`, `authors`, `media`), globals `settings`/`about`/`legal`, versions/drafts, live preview avec jetons signés, hooks SEO Gemini et revalidation de cache. Admin sur `api.lassez.fr/admin`.

4. **Daemon Radar** (`radar_lassez/`) — pipeline d'automatisation : ingestion multi-sources (RSS, Google News, Telegram, X), dédoublonnage, scoring de pertinence (Gemini Flash), rédaction d'investigation (Gemini Pro), validation, enrichissement média, puis publication (Payload + Discord/X/Bluesky/Mastodon). Deux boucles autonomes : cycle principal + publisher toutes les 2 min.

## 🧱 Stack

- **Front** : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **CMS** : Payload 3.82 (Postgres / Supabase), Rich Text Lexical
- **Daemon** : Prisma (SQLite), Gemini (Flash/Pro), better-sqlite3
- **Ops** : PM2 (4 processus), GitHub Actions, VPS nginx, Matomo

## 🚀 Démarrage en local

```bash
npm install
cp .env.example .env   # puis remplir les valeurs
npm run dev            # http://localhost:5173
```

Routes utiles en dev :
- Site public : `http://localhost:5173`
- Admin Payload : `http://localhost:5173/admin` (ou via `PAYLOAD_SERVER_URL`)
- Cockpit Studio : `http://localhost:5173/radar-admin`
- Daemon : `npx tsx radar_lassez/daemon.ts` (optionnel, nécessite la config SQLite)

## 🗄️ Bases de données

| Base | Techno | Usage |
| :--- | :--- | :--- |
| Payload | Postgres (Supabase) via `DATABASE_URL` | Contenu éditorial, auteurs, médias, globals |
| Radar | SQLite (`prisma/radar.db`) | Settings du daemon, topics, publications, logs, health des sources |

Migrations Payload : `npm run payload:migrate` · Types générés : `npm run payload:generate:types`

## 🚢 Déploiement

**Un seul pipeline** : push sur `main` → GitHub Actions → VPS → PM2. Voir [`docs/deployment_guide.md`](docs/deployment_guide.md).

- 4 processus PM2 : `lassez-front` (3000), `lassez-api` (3001), `lassez-studio` (3002), `lassez-daemon` (3005)
- Fallback manuel : `npm run deploy:vps` (nécessite `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`)

## 📁 Structure

```
app/(frontend)/        Site public + Radar-admin
app/(studio)/          Studio de templates
app/api/               Routes API (radar, posts, og, preview, elections, cache-sync…)
components/            Composants React partagés
payload/               Config Payload : collections, globals, hooks, migrations
radar_lassez/          Daemon d'automatisation (pipeline 7 nœuds)
lib/                   Utilitaires partagés (API, SEO, preview, radar-config…)
hooks/                 Hooks React (usePosts, useCategories…)
scripts/               Scripts dev/ops (deploy, checks VPS, seeds, utilitaires)
prisma/                Schéma SQLite du daemon Radar
docs/                  Guides (déploiement, nginx, plans)
```

## ✅ Scripts npm utiles

```bash
npm run dev                 # Dev server (port 5173)
npm run build               # Build de production
npm run payload:seed        # Seed du CMS
npm run payload:migrate     # Migrations Payload
npm run deploy:vps          # Déploiement manuel vers le VPS
npm run test:payload:api    # Validation du bridge Payload
```
