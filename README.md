# L'Assez — Plateforme Média & Radar d'Investigation

**L'Assez** est un média d'investigation indépendant (lassez.fr). Ce monorepo contient la plateforme complète : le site public, le cockpit de rédaction/automatisation (Studio), et le daemon Radar qui aspire, analyse, rédige et publie du contenu via IA.

## 🏗️ Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Front public (lassez.fr)   │     │  Studio (studio.lassez.fr)   │
│  Next.js App Router + RSC   │     │  Éditeur de templates        │
│  composants "papier"        │     │  (FFmpeg.wasm)               │
└──────────┬──────────────────┘     └──────────────┬───────────────┘
           │                                       │
           ▼                                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Payload CMS (api.lassez.fr)                     │
│  admin + Cockpit Radar (single login) : collections signals,       │
│  sources, publications, logs, taxonomy-templates, posts,           │
│  revelations, categories, tags, authors + globals radar-settings   │
│  (Postgres / Supabase)                                             │
└──────────────────────────────────────┬─────────────────────────────┘
                                       │ API REST + logs (heartbeat)
                                       ▼
┌────────────────────────────────────────────────────────────────────┐
│                    Daemon Radar (daemon/, en Go)                    │
│  Pipeline 7 nœuds : ingestion → dedup → research → editorial →      │
│  validator → media → publisher. Deux boucles autonomes : cycle      │
│  planifié (pulse/calendrier) + publisher toutes les 2 min.          │
└────────────────────────────────────────────────────────────────────┘
```

### Les 4 blocs

1. **Front public** (`app/(frontend)/` + `components/`) — le site éditorial : home, articles, révélations, enquêtes, podcasts, comprendre (leçons), élections live, recherche, soutenir. Pages RSC servies par Payload, ISR avec revalidation instantanée, SEO auto-généré (Gemini).

2. **Cockpit Radar** (`payload/`) — intégré à l'admin Payload (`/admin`, single login) : dashboard du pipeline, collections `signals`/`sources`/`publications`/`logs`/`taxonomy-templates`, global `radar-settings`. L'éditeur de templates de visualisation (FFmpeg.wasm) reste dans `app/(studio)/templates` (studio.lassez.fr).

3. **Payload CMS** (`payload/`) — back-office éditorial : collections `posts`, `revelations`, `lessons` (+ `categories`, `tags`, `authors`, `media`), globals `settings`/`about`/`legal`, versions/drafts, live preview avec jetons signés, hooks SEO Gemini et revalidation de cache. Admin sur `api.lassez.fr/admin`.

4. **Daemon Radar** (`daemon/`, en Go) — pipeline d'automatisation : ingestion multi-sources (RSS, Google News), dédoublonnage, scoring de pertinence (Gemini Flash), rédaction d'investigation (Gemini Pro), validation, enrichissement média, puis publication (Payload CMS + Discord). Il lit/écrit dans Payload via l'API REST et heartbeats l'admin (collection `logs`). Deux boucles autonomes : cycle planifié (pulse/calendrier via `radar-settings`) + publisher toutes les 2 min. Le graphe actif des nœuds est pilotable depuis l'admin (`pipelineGraphJson`).

## 🧱 Stack

- **Front** : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **CMS** : Payload 3.82 (Postgres / Supabase), Rich Text Lexical
- **Daemon** : Go, client Payload REST, Gemini (Flash/Pro), gofeed (RSS)
- **Ops** : PM2 (4 processus), GitHub Actions, VPS nginx, Matomo

## 🚀 Démarrage en local

```bash
npm install
cp .env.example .env   # puis remplir les valeurs
npm run dev            # http://localhost:5173
```

Routes utiles en dev :
- Site public : `http://localhost:5173`
- Admin Payload + Cockpit Radar : `http://localhost:5173/admin` (ou via `PAYLOAD_SERVER_URL`)
- Studio de templates : `http://localhost:5173/templates`
- Daemon : `cd daemon && go build -o bin/daemon ./cmd/daemon && ./bin/daemon` (nécessite `PAYLOAD_API_URL` + identifiants bot dans `.env`)

## 🗄️ Bases de données

| Base | Techno | Usage |
| :--- | :--- | :--- |
| Payload | Postgres (Supabase) via `DATABASE_URL` | Contenu éditorial, auteurs, médias, globals |
| Radar | Payload (Postgres) via API REST | Collections `signals`, `sources`, `publications`, `seen-urls`, `taxonomy-templates`, `logs` + global `radar-settings` |
| Legacy front | SQLite (`data/radar.db`) | Élections, config/nav, archives (non versionné, poussé via `push_radar_db_to_vps.cjs`) |

Migrations Payload : `npm run payload:migrate` · Types générés : `npm run payload:generate:types`

## 🚢 Déploiement

**Un seul pipeline** : push sur `main` → GitHub Actions → VPS → PM2. Voir [`docs/deployment_guide.md`](docs/deployment_guide.md).

- 4 processus PM2 : `lassez-front` (3000), `lassez-api` (3001), `lassez-studio` (3002), `lassez-daemon` (3005)
- Fallback manuel : `npm run deploy:vps` (nécessite `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`)

## 📁 Structure

```
app/(frontend)/        Site public (home, articles, enquêtes, élections, …)
app/(studio)/          Studio de templates (FFmpeg.wasm)
app/api/               Routes API (radar, posts, og, preview, elections, cache-sync…)
components/            Composants React partagés
payload/               Config Payload : collections, globals, hooks, migrations, vues du cockpit
daemon/                Daemon d'automatisation en Go (pipeline 7 nœuds, client Payload)
data/                  Base SQLite legacy du front (élections, config, nav)
lib/                   Utilitaires partagés (API, SEO, preview, radar-config…)
hooks/                 Hooks React (usePosts, useCategories…)
scripts/               Scripts dev/ops (deploy, migration Radar → Payload, utilitaires)
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
