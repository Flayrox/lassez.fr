# L'Assez — Plateforme Média d'Investigation

**L'Assez** est un média d'investigation indépendant (lassez.fr). Ce monorepo contient la plateforme complète : le site public, le cockpit de rédaction/automatisation (Studio), et le daemon Go qui aspire, analyse, rédige et publie du contenu via IA.

## 🏗️ Architecture

```
┌─────────────────────────────┐     ┌──────────────────────────────┐
│  Front public (lassez.fr)   │     │  Studio (apps/studio)        │
│  Next.js App Router + RSC   │     │  Cockpit Vue/Vite — pilote le│
│  contenu via lib/provider.ts│     │  daemon : sources, planning, │
│  (stub — provider à         │     │  modération, suivi, pub.     │
│  brancher plus tard)        │     │                              │
└─────────────────────────────┘     └──────────────┬───────────────┘
                                                   │ API REST (localhost)
                                                   ▼
                                    ┌────────────────────────────────┐
                                    │  Daemon (daemon/, en Go)        │
                                    │  Pipeline 6 nœuds : ingestion   │
                                    │  RSS → dedup → research →       │
                                    │  editorial → validator → media. │
                                    │  Publisher : qoe.fi + Discord.  │
                                    └──────────────┬─────────────────┘
                                                   │ SQLite + config YAML
                                                   ▼
                                       Bases locales (data/pipeline.db)
```

### Les 4 blocs

1. **Front public** (`app/(frontend)/` + `components/`) — le site éditorial : home, articles, révélations, enquêtes, comprendre (leçons), élections live, recherche, soutenir. Le contenu passe par la couche `lib/provider.ts`, actuellement un **stub** (listes vides) en attendant le futur provider — les pages élections sont déjà branchées sur leurs bases SQLite locales.

2. **Studio** (`apps/studio/`) — le cockpit qui pilote le daemon : sources (ingestion 100 % RSS), planning (grille 7×24), formats, prompts, modération des signaux, suivi des cycles, publication. Il parle au daemon via son API HTTP.

3. **Daemon** (`daemon/`, en Go) — pipeline d'automatisation : ingestion RSS, dédoublonnage, scoring de pertinence (Gemini Flash), rédaction d'investigation (Gemini Pro), validation, enrichissement média, puis publication (qoe.fi + Discord). Tout est stocké en SQLite local (`data/pipeline.db`) et configuré via `daemon/config/config.yaml` (+ `.secrets.yaml` local). Deux boucles autonomes : cycle planifié + publisher.

4. **Bases locales** — `data/pipeline.db` (pipeline daemon, tables `daemon_*`) et `data/elections/` (une base par scrutin + registre). Aucune base distante : tout est local, en dev uniquement.

## 🧱 Stack

- **Front** : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS
- **Studio** : Vue 3 + Vite (`apps/studio`)
- **Daemon** : Go, Gemini (AI Studio + repli Vertex), gofeed (RSS), SQLite
- **Publication** : qoe.fi (API REST) + Discord (webhook)

## 🚀 Démarrage en local

```bash
npm install
cp .env.example .env   # puis remplir les valeurs
npm run dev            # http://localhost:2500
```

Routes utiles en dev :
- Site public : `http://localhost:2500`
- Studio : `npm run dev:studio` (Vite)
- Daemon : `cd daemon && go build -o bin/daemon ./cmd/daemon && ./bin/daemon` (nécessite `GEMINI_API_KEY` dans `.env` ou `daemon/config/.secrets.yaml` ; la clé Discord et la clé qoe.fi se configurent depuis le studio → `.secrets.yaml`)

### Dev tout-en-un — domaines `.test` SANS port + ports dédiés

```bash
npm run dev:domain
# → Studio (Vue, pilote le daemon) : http://studio.lassez.test   (sans port)
# → Front site (Next.js)           : http://lassez.test          (sans port)
# → Daemon API : 127.0.0.1:4406 · Ports directs : :4405 (studio), :2500 (front)
```

`scripts/dev-domain.sh` ajoute les entrées `/etc/hosts` (`127.0.0.1 studio.lassez.test lassez.test`, sudo demandé une fois), compile le daemon Go (`127.0.0.1:4406`), lance le studio Vite (`:4405`) et le front Next (`:2500`), puis recharge le `Caddyfile.dev` local (celui de qoe.fi, qui contient les blocs `lassez.test` / `studio.lassez.test`) pour servir le tout **sans port**. `Ctrl-C` arrête les trois.

Surcharge : `STUDIO_HOST`, `FRONT_HOST`, `STUDIO_PORT`, `DAEMON_PORT`, `NEXT_PORT`, `CADDY_CONFIG` (chemin du Caddyfile à recharger). Sans Caddy lancé, les URL avec port fonctionnent quand même.

Classique sans domaine : `npm run dev:studio` (studio seul) + `cd daemon && go build -o bin/daemon ./cmd/daemon && ./bin/daemon` (daemon sur `:2506`).

## 🗄️ Bases de données

| Base | Techno | Usage |
| :--- | :--- | :--- |
| **Pipeline (daemon)** | SQLite (`data/pipeline.db`) | Tables `daemon_*` uniquement : signaux, seen-urls, publications, cycles, santé des sources — écrites par le daemon Go, lues par le studio via l'API |
| **Élections** | SQLite, **1 fichier par scrutin** (`data/elections/{slug}.db`) | Résultats officiels, overrides manuels, statut de sync + réglages scopés — écrits par le front (`app/api/elections/results`), lus par les pages élections et le sitemap |
| Registre élections | JSON (`data/elections/registry.json`) | Liste des scrutins affichés (`displaySlugs`) + scrutin cible (`targetSlug`) |

### 🗄️ Schéma des bases locales (SQLite)

Depuis le refactor des bases, le pipeline et les élections **ne partagent plus le même fichier** :

```
data/
├── pipeline.db                 # PIPELINE uniquement — tables daemon_* (écrit par le daemon Go)
│   ├── daemon_signals          #   signaux du pipeline (INGESTED → … → PUBLISHED)
│   ├── daemon_publications     #   missions de diffusion par plateforme
│   ├── daemon_seen_urls        #   anti-doublon (URLs déjà aspirées)
│   ├── daemon_cycles           #   historique des cycles (Suivi du studio)
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
apps/studio/           Studio de pilotage du pipeline (Vue/Vite)
components/            Composants React partagés
daemon/                Daemon d'automatisation en Go (pipeline 6 nœuds)
data/                  Bases SQLite locales (pipeline.db + elections/)
lib/                   Utilitaires partagés (API, SEO, preview, elections…)
hooks/                 Hooks React (usePosts, useCategories…)
scripts/               Scripts dev (migrations, utilitaires)
docs/                  Réflexions, plans, notes
```

## ✅ Scripts npm utiles

```bash
npm run dev                 # Front Next.js (port 2500)
npm run dev:studio          # Studio (Vite)
npm run dev:domain          # Tout-en-un : domaines .test sans port
npm run dev:all             # Front + studio en parallèle
npm run build               # Build de production
```
