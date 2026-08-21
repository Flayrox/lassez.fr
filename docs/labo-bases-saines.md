# Radar — Base saine (extraction ancien admin + DB VPS)

> Source : commit `7e19af2` (25/07/2026, il y a ~4 semaines) + `data/radar.db.vps-2026-08-21.bak` (VPS `178.104.197.3:/var/www/radar.db`, 04/08/2026).
> Objectif : partir sur des bases saines pour le nouveau **labo** (`labo.lassez.fr`) et le **daemon Go**.

---

## 1. L'ancien radar admin — comment c'était fait

### 1.1 Arborescence (commit 7e19af2)

```
app/(frontend)/radar-admin/
├── page.tsx                      # Signaux : tabs LAB/REVIEW/QUEUE/DONE/TRASH + geo filter + search + bulk
├── layout.tsx
├── components/
│   ├── RadarAdminContext.tsx     # Store global : posts, sources, settings, isDaemonRunning, countdown
│   ├── ModernDashboardLayout.tsx # Layout principal (header + sidebar)
│   ├── ModernRadarTable.tsx      # Table des signaux
│   ├── ModernRadarCard.tsx       # Carte signal (type_ouverture coloré, status, actions)
│   ├── BulkActionBar.tsx         # Actions groupées (approve/reject/delete)
│   ├── EditPostModal.tsx         # Édition d'un signal
│   ├── ManualScanModal.tsx       # Scan manuel avec config custom
│   ├── LiveLogsPanel.tsx         # Logs en direct
│   ├── FloatingTerminal.tsx      # Terminal flottant
│   ├── ConsoleTab.tsx            # Console daemon
│   ├── NodeInspector.tsx         # Inspecteur de nœud du graphe (sync pending/saved)
│   └── DaemonRssConfigModal.tsx
├── context/UIContext.tsx
├── daemon/page.tsx               # DaemonStatusCards + Pm2ControlPanel
├── flow/page.tsx                 # Graphe pipeline visuel (FlowCanvas + NodeInspector)
├── lab/page.tsx                  # Cortex lab
├── network/page.tsx              # Réseau X/Twitter (x_accounts)
├── users/page.tsx                # Équipe (radar_users)
├── studio/                       # Studio templates (FFmpeg.wasm) — réintégré au labo plus tard
└── settings/
    ├── page.tsx                  # 9 onglets : sources/pipeline/taxonomies/prompts/daemon/diffusion/health/users/advanced
    └── components/
        ├── SourcesSection.tsx    # Table CRUD sources + health + trust_score + bias
        ├── PipelineSection.tsx   # Modèles IA + seuils + keywords/banned + prompt override
        ├── TaxonomySection.tsx   # Formats d'articles CRUD (5 champs + examples JSON)
        ├── PromptSection.tsx     # 6 blocs de prompts (dirty Set, expand, reset factory)
        ├── DaemonSection.tsx     # Planning : 3 modes + grille 7 jours × 24h drag-select
        ├── DiffusionSection.tsx  # Plateformes : toggle + DIRECT/SCHEDULED + clés API par réseau
        ├── HealthSection.tsx     # Santé système temps réel (poll 30s)
        ├── AdvancedSection.tsx   # Registry modèles IA (label + value CRUD)
        └── UserSection.tsx       # Équipe
```

### 1.2 Détail de chaque onglet Settings

#### Sources (`SourcesSection.tsx`)
- Table CRUD complet : `source_name`, `url`, `type` (RSS/TELEGRAM/GOOGLE_NEWS), `source_bias` (9 valeurs : Extrême-Gauche → Extrême-Droite, Service Public, Indépendant), `trust_score` (0-10), `allowSourceImages`
- Health par source : `HEALTHY / DEGRADED / DISABLED`, `consecutive_failures`, `last_error`, bouton reset health
- Tri sur colonnes, quarantaine automatique des sources en échec

#### Pipeline / Moteur IA (`PipelineSection.tsx`)
- Sélection modèle Pro (rédaction) + Flash (tri) depuis le registry
- Slider `similarityThreshold` (0.1–0.9) + `dedupLookbackHours`
- Toggle global "Image Enrichment" (OSINT auto)
- `keywords` (focus) + `bannedKeywords` (noise) en textarea
- `customPromptModifier` : consigne globale ajoutée au prompt du cycle

#### Taxonomies / Formats (`TaxonomySection.tsx`)
- CRUD complet par format : `name` (ID technique), `displayName` (affiché), `description`, `formatInstructions` (prompt), `examplesJson` (liste d'exemples), `outputSchemaJson`, `accentColor`, `isFactory` (non supprimable), `active`, `sortOrder`
- Expand/collapse par format, save par format (dirty Set)

#### Prompts / Ligne éditoriale (`PromptSection.tsx`)
6 blocs, chacun = label + description + icon + textarea :
| Clé | Rôle |
|---|---|
| `baseIdentityPrompt` | Identité éditoriale L'Assez |
| `researchMissionPrompt` | Mission d'enquête |
| `vocabularyRulesPrompt` | Règles de vocabulaire |
| `imageRulesPrompt` | Méthode de sélection d'images |
| `researcherSystemPrompt` | Directive de tri (researcher) |
| `researcherRejectCriteria` | Critères de rejet explicites |

- Badge "Modified" par bloc, compteur chars, "Reset to Factory" (= vide → fallback code)

#### Planning (`DaemonSection.tsx`) — le plus abouti
- 3 modes : **Hybride** (mix), **Fréquence continue** (scan toutes les X min), **Calendrier strict** (heures noircies uniquement)
- Toggle "Publier automatiquement" (sinon l'IA prépare mais ne publie pas)
- `scrapingInterval` (min), délais anti-robot min/max (random entre les deux avant post réseaux)
- **Grille 7 jours × 24 heures** : drag rectangle pour sélectionner/désélectionner les créneaux de scan (`LUN 08:00`, etc.), sérialisé en lignes `JOUR HH:MM`
- Bouton "Clear all"

#### Diffusion (`DiffusionSection.tsx`)
- Table plateformes : Discord, X, Bluesky, Mastodon, CMS (Payload à l'époque → qoe.fi maintenant)
- Par plateforme : toggle ON/OFF + stratégie **Temps réel / Planifié**
- Champs API spécifiques affichés si activée : webhook Discord, API keys X (4 champs), identifier+app password Bluesky, instance+token Mastodon

#### Santé (`HealthSection.tsx`)
- Cards temps réel (poll 30s) : dot vert/jaune/rouge par composant + message

#### Avancé (`AdvancedSection.tsx`)
- **Registry modèles IA** : liste `label (UI)` + `value (API ID)` CRUD — alimente tous les selects du reste de l'UI
- Warning : changement immédiat sur tous les nœuds

### 1.3 Page Signaux (le cœur opérationnel)
- Tabs par statut : `LAB` (cortex), `REVIEW`, `QUEUE` (scheduled), `DONE` (publié), `TRASH` (rejeté)
- Filtre géo (all/france/international) + recherche texte
- Sélection multiple → actions bulk (status/delete)
- Édition inline d'un signal (titre, contenu, image keyword)
- Scan manuel avec config custom
- Countdown prochain scan + badge daemon vivant (heartbeat 30s)

---

## 2. Données extraites de la DB VPS (radar.db SQLite)

### 2.1 Tables présentes

| Table | Lignes | Usage |
|---|---|---|
| `radar_settings` | 82 clés | Toute la config (ci-dessous §2.2) |
| `radar_posts` | 1336 | Signaux : PENDING 111 · APPROVED 1 · PUBLISHED 34 · IGNORED 1190 |
| `radar_archives` (FTS5) | 77 | Archives plein texte (date, entité, mots-clés, declaration_brute) |
| `radar_nav_config` | 7 | Nav front (La Une, Enquêtes, Révélation, Investigation, Comprendre, Élections, Soutenir) |
| `radar_social_drafts` | 2 | Brouillons réseaux sociaux |
| `elections_officiel_cache` | 54 118 | Cache résultats officiels data.gouv |
| `elections_registry` / `election_sources` / `election_daemon_config` / … | 1-2 | Config municipales-2026 |
| `radar_logs` | 12 | Logs |
| `radar_users` | 1 | Users (admin/editor/viewer + permissions JSON) |

### 2.2 La config complète (82 clés `radar_settings`) — traduite en français clair

**Sources & ingestion**
- `rss_feeds` : 13 flux actifs (France24, RFI, Le Monde, Mediapart, FranceInfo, Humanité, La Croix, Nouvel Obs, Midi Libre, Le Parisien, Blast, Basta, Reporterre)
- Dans le graphe : jusqu'à 36 flux (incl. Figaro, RTL, Palestine Chronicle, Wafa, Palinfo, Maan, Haaretz, +972mag, B'Tselem, Amnesty, HRW, FIDH, PHR, GlobalVoices, ONU, FreedomHouse, GlobalIssues, Chatham House, The Conversation, Basta, Reporterre)
- `telegram_channels` : brevesdepresse, AlertesInfos, mediavenir, bfmtv_fr, cnews_fr, FranceInsoumise
- `google_news_queries` : vide
- `rss_lookback_hours`: 10 · `max_articles`: 20 · `scan_interval_hours`: 0.1 (6 min !)
- `source_trust_map` : 🟢 confiance haute (Mediapart, Humanité, Blast, Reporterre, Basta, Politis, AI, ONG palestiniennes, FI…), 🟡 moyenne (France24, RFI, Le Monde…), 🔴 faible (Figaro, CNews, BFM…)

**Anti-doublons**
- `dedup_similarity_threshold`: 0.65 · `dedup_recent_hours`: 10

**Modèles IA (par type d'article)**
- `ai_model_main/breaking`: gemini-3-flash-preview · `ai_model_standard`: gemini-2.5-flash · `ai_model_decrypt`: gemini-2.5-pro
- Dans le graphe : researcher = gemini-3.1-pro-preview, editor = gemini-2.5-pro, rss = gemini-3.1-pro-preview
- `ai_prompt_*` : tous vides (prompts par défaut du code utilisés)
- Google Search activé pour breaking/décryptage/standard

**Types d'ouverture (formats) observés dans les posts**
- 📌 LE FAIT DU JOUR (1271), 🔴 ALERTE INFO ! (49), 🔎 DÉCRYPTAGE (6), 🔴 URGENT (2), + rares (FLASH SUPERFICIEL, BREAKING, CORRECTION HISTORIQUE, FLASH INTERNATIONAL, RENSEIGNEMENT, ALERTE GÉNÉRALE)
- `fiabilite`: haute (1314) / moyenne (22)
- `daemon_rss_types`: ["🔴 ALERTE INFO !"]

**Planification**
- Mode calendrier : `daemon_rss_schedule_enabled: true`, `schedule_times: 20:08` quotidien
- Interval désactivé ; `next_scan_at` stocké en DB ; heartbeat via `updatedAt`
- Anti-spam : `min_delay_min: 1`, `max_delay_min: 2` minutes entre publications
- Profils séparés RSS vs Publisher (`daemon_profiles_json`) : publisher garde 18 articles max, délais 1–2 min

**Partage**
- `social_targets_by_type_json` : {"🔴 ALERTE INFO !" → Discord seulement}
- Discord activé (+ test mode), Mastodon/Bluesky/Twitter désactivés
- `x_accounts` suivis via bridge RSS local : JLMelenchon, MathildePanot, RimaHas, Manuel_Bompard, FranceInsoumise, ImpactMediaFR
- `rss_bridge_base_url`: http://localhost:3300 (RSS-Bridge pour Twitter)

**Graphe pipeline (pipeline_graph_json) — 11 nœuds, positions sauvegardées**
```
source-rss (36 URLs) ─┐
source-telegram (6)  ─┼→ proc-dedup (0.65/24h) → agent-research → agent-editor → agent-validator → proc-dist ─┬→ target-cms
source-google (vide) ─┘                                                                                          └→ target-discord
```

**Santé / erreurs scan (last_scan_errors)** — 22 sources en échec à la dernière passe :
404 : rtl.fr, wafa.ps, haaretz, fidh.org, freedomhouse, theconversation, blast-info
403 : maannews, btselem, amnesty, chathamhouse
429 : palestinechronicle, btselem
XML cassé : arretsurimages, thenewhumanitarian, news.un.org, globalissues, politis

**Divers**
- Image : overlay activé (opacity 0.5), box scale 0.78 (16:9 et 1:1)
- Video ingest : désactivé (modèle prefilter/transcribe gemini-2.0-flash, max audio 20MB, prompt OUI/NON politique/social/justice)
- Popup don : titre/texte/liens stockés
- Maintenance mode : off (message prêt)
- Élections municipales-2026 : datasets data.gouv 4 fichiers (résultats+candidatures T1/T2), sync 30 min, daemon off, live off
- Nav front : La Une ✓, Enquêtes ✓, Révélation ✓, Investigation ✗, Comprendre ✗, Élections ✓, Soutenir ✓

---

## 3. Ce qu'on garde pour le labo (base saine)

1. **Les 82 réglages**, rangés en 9 onglets comme l'ancien admin (Sources, Moteur IA, Formats, Ligne éditoriale, Planning, Partage, Santé, Équipe, Modèles IA)
2. **La grille planning 7×24 drag** de `DaemonSection.tsx` (le meilleur morceau d'UX) + modes hybride/pulse/calendrier + anti-robot min/max
3. **Le registry de modèles IA** (AdvancedSection) qui alimente tous les selects
4. **La table sources avec santé** (health, consecutive_failures, quarantine) + trust map 🟢🟡🔴
5. **Les 6 blocs de prompts** avec labels FR clairs + Reset Factory + compteur
6. **Les formats** avec exemples un-par-un (pas de JSON brut) + couleur + isFactory lock
7. **La matrice de partage par type** (`ALERTE INFO → Discord`) plutôt qu'un toggle global
8. **La page Signaux** (LAB/REVIEW/QUEUE/DONE/TRASH + geo + search + bulk + countdown) — absente du labo actuel, à recréer
9. **Les données** : 1336 posts (dont 111 en attente), archives FTS, cache élections 54k lignes — restent dans `data/radar.db`
10. **Zéro Payload/Supabase** : publication vers qoe.fi (mock tant que clé pas créée), tout le reste local
