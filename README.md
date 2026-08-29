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
- **Ops** : Matomo

## 🚀 Démarrage en local

```bash
npm install
cp .env.example .env   # puis remplir les valeurs
npm run dev            # http://localhost:2500
```

Routes utiles en dev :
- Site public : `http://localhost:2500`
- Labo studio : `npm run dev:labo` (Vite)
- Daemon : `cd daemon && go build -o bin/daemon ./cmd/daemon && ./bin/daemon` (nécessite `PAYLOAD_API_URL` + identifiants bot dans `.env`)

### Dev tout-en-un — domaines `.test` SANS port + ports dédiés

```bash
npm run dev:domain
# → Studio (labo Vue, pilote le daemon) : http://studio.lassez.test   (sans port)
# → Front site (Next.js)                : http://lassez.test          (sans port)
# → Daemon API : 127.0.0.1:4406 · Ports directs : :4405 (labo), :2500 (front)
```

`scripts/dev-domain.sh` ajoute les entrées `/etc/hosts` (`127.0.0.1 studio.lassez.test lassez.test`, sudo demandé une fois), compile le daemon Go (`127.0.0.1:4406`), lance le labo Vite (`:4405`) et le front Next (`:2500`), puis recharge le `Caddyfile.dev` local (celui de qoe.fi, qui contient les blocs `lassez.test` / `studio.lassez.test`) pour servir le tout **sans port**. `Ctrl-C` arrête les trois.

Surcharge : `LABO_HOST`, `FRONT_HOST`, `LABO_PORT`, `DAEMON_PORT`, `NEXT_PORT`, `CADDY_CONFIG` (chemin du Caddyfile à recharger). Sans Caddy lancé, les URL avec port fonctionnent quand même.

Classique sans domaine : `npm run dev:labo` (labo seul) + `cd daemon && go build -o bin/daemon ./cmd/daemon && ./bin/daemon` (daemon sur `:2506`).

## 🗄️ Bases de données

| Base | Techno | Usage |
| :--- | :--- | :--- |
| Payload | Postgres (Supabase) via `DATABASE_URL` | Contenu éditorial, auteurs, médias, globals |
| Radar | Payload (Postgres) via API REST | Collections `signals`, `sources`, `publications`, `seen-urls`, `taxonomy-templates`, `logs` + global `radar-settings` |
| Site (ex `radar_settings`) | Payload global `settings` | Maintenance + popup (groupe `communication`, ex-table SQLite — migré via `scripts/migrate_radar_settings_to_payload.cjs`) |
| **Pipeline (daemon)** | SQLite (`data/radar.db`) | Tables `daemon_*` uniquement : signaux, seen-urls, publications, cycles, santé des sources — écrites par le daemon Go, lues par le labo via l'API |
| **Élections** | SQLite, **1 fichier par scrutin** (`data/elections/{slug}.db`) | Résultats officiels, overrides manuels, statut de sync + réglages scopés — écrits par le front (`app/api/elections/results`), lus par les pages élections et le sitemap |
| Registre élections | JSON (`data/elections/registry.json`) | Liste des scrutins affichés (`displaySlugs`) + scrutin cible (`targetSlug`) |

### 🗄️ Schéma des bases locales (SQLite)

Depuis le refactor des bases, le pipeline et les élections **ne partagent plus le même fichier** :

```
data/
├── radar.db                    # PIPELINE uniquement — tables daemon_* (écrit par le daemon Go)
│   ├── daemon_signals          #   signaux du pipeline (INGESTED → … → PUBLISHED)
│   ├── daemon_publications     #   missions de diffusion par plateforme
│   ├── daemon_seen_urls        #   anti-doublon (URLs déjà aspirées)
│   ├── daemon_cycles           #   historique des cycles (Suivi du labo)
│   ├── daemon_cycle_steps      #   étapes de chaque cycle
│   └── daemon_source_health    #   santé des sources (HEALTHY/DEGRADED/DISABLED)
└── elections/
    ├── registry.json           # { displaySlugs: [...], targetSlug: "..." }
    ├── municipales-2026.db     # 1 fichier PAR scrutin
    └── presidentielles-2027.db #   (le prochain scrutin = un nouveau fichier)
```

Chaque base d'élection contient : `elections_officiel_cache` (résultats officiels data.gouv), `elections_resultats` (overrides manuels du studio), `elections_sync_status` (dernière sync) et `election_settings` (réglages scopés : sources data.gouv, dernière source utilisée).

**Pourquoi séparer ?** SQLite n'autorise qu'un écrivain à la fois. La sync des élections (réécriture de ~54 k lignes toutes les 30 min) partageait le fichier avec les écritures du daemon (toutes les 2 min) → risque de verrou/timeout. Chaque domaine a maintenant son fichier et son écrivain : plus aucune contention, et vider le pipeline pour un test ne touche jamais les élections.

#### ➕ Ajouter une nouvelle élection

1. **Créer le fichier** : la route `app/api/elections/results` crée la base à la volée (`CREATE TABLE IF NOT EXISTS`) au premier appel avec `?slug=xxx` — ou lancer `node scripts/migrate-elections-db.cjs` qui génère un fichier vide par slug.
2. **Renseigner le registre** : `data/elections/registry.json` — ajouter le slug dans `displaySlugs` (et éventuellement le mettre en `targetSlug`).
3. **Configurer les sources** (optionnel) : dans la base de l'élection, table `election_settings`, clé `election_sources_json` (datasets data.gouv) — le studio le fera bientôt via la page Admin Élections.
4. **Sync** : appeler `/api/elections/results?slug=xxx&forceSync=1` pour aspirer les données officielles.

Références dans le code : `lib/elections-db.ts` (chemins + registre).

## 🚢 Déploiement

> ❌ Aucun déploiement — projet en dev uniquement. Les artefacts de déploiement (workflow GitHub Actions, PM2, VPS, scripts deploy) ont été retirés.

## 📁 Structure

```
app/(frontend)/        Site public (home, articles, enquêtes, élections, …)
app/api/               Routes API (elections, posts, og, preview, proxy-image…)
apps/labo/             Studio de pilotage du pipeline (Vue/Vite)
components/            Composants React partagés
daemon/                Daemon d'automatisation en Go (pipeline 7 nœuds)
data/                  Bases SQLite locales (radar.db pipeline + elections/)
lib/                   Utilitaires partagés (API, SEO, preview, elections…)
hooks/                 Hooks React (usePosts, useCategories…)
scripts/               Scripts dev (migrations, utilitaires)
docs/                  Réflexions, plans, notes
```

## ✅ Scripts npm utiles

```bash
npm run dev                 # Front Next.js (port 2500)
npm run dev:labo            # Labo studio (Vite)
npm run dev:domain          # Tout-en-un : domaines .test sans port
npm run dev:all             # Front + labo en parallèle
npm run build               # Build de production
```
