# Nos réflexions — Pipeline intelligent, mémoire éditoriale & équipe IA

> Document de travail (non implémenté — simple trace de nos échanges).
> Dernière mise à jour : 29/08/2026.

---

## 1. Où on en est vraiment (la question « top du top ? »)

**Sur la forme (vitesse, légèreté, propreté), on est très proches du sommet :**

- Front Next.js clean : Payload / WordPress / Supabase / radar TS virés. Build ~835 ms, TS ~1,2 s, 18/18 pages.
- Daemon **100 % Go**, pipeline explicite en 7 nœuds : `ingestion → dedup → research → editorial → validator → media → publisher`. Zéro charge serveur au-delà d'un binaire + du statique.
- Labo Vue/Vite (`apps/labo`) : aussi configurable que l'ancien radar-admin, sans le jargon, design Stripe-like.
- Bases séparées : `data/radar.db` (pipeline, tables `daemon_*`) + 1 fichier par élection (`data/elections/{slug}.db`) + registre JSON. Plus aucune contention SQLite.
- Recherche web **réelle** à chaque appel IA (grounding Google), replis anti-quota (AI Studio → Vertex, modèle lourd → Flash Lite), sortie JSON verrouillée.

**Sur le fond (l'intelligence), on plafonne à l'instant T.** Chaque article est écrit de zéro, avec uniquement la matière du jour. C'est exactement le plafond que les paliers ci-dessous cassent.

---

## 2. La question qui a tout déclenché : « est-ce que la pipeline est intelligente ? »

**Le cas test :** Bruno Retailleau dit une connerie il y a 3 semaines → aujourd'hui il se contredit. Le daemon va-t-il le capter ?

**Réponse honnête : pas aujourd'hui, sauf coup de chance.** Pourquoi :

| Capacité | État actuel |
|---|---|
| Mémoire à travers les articles | ❌ Aucune. Chaque rédaction repart de zéro, sans savoir ce qu'on a déjà écrit/analysé. |
| Recherche du « passif » d'un protagoniste | ⚠️ Opportuniste. L'IA choisit elle-même ses requêtes ; elle ne va pas forcément chercher « ce que Retailleau a dit il y a 3 semaines ». Et chaque recherche coûte (quota). |
| Dédoublonnage | ❌ Il évite de reprendre la même dépêche ; il ne suit pas les déclarations d'une personnalité dans le temps. |
| Suivi des contradictions | ❌ Rien ne relie l'article d'aujourd'hui à celui d'il y a 3 semaines. |

**Ce que le pipeline sait déjà faire pour ce cas :** si l'article du jour mentionne lui-même l'ancienne déclaration, la matière première la contient et le modèle l'exploite (thinking élevé + recherche + citations exactes → contradiction visible). Mais c'est de l'opportunisme, pas un réflexe.

**En une phrase :** *le pipeline est intelligent à l'intérieur d'un sujet, pas à travers le temps.*

---

## 3. La brique qui règle le cas : la « Mémoire éditoriale » — **Palier 1**

Ce n'est **pas** un problème d'intelligence, c'est un problème de **données**. Injecter le passé dans le prompt suffit : le même modèle de rédaction détectera seul la contradiction.

**Concrètement :**

1. Le daemon archive ce qu'il publie (et les faits structurés qui vont avec) dans une table dédiée (ex. `daemon_publications` enrichie ou nouvelle table `daemon_memoire`).
2. À chaque rédaction, on injecte dans le prompt : *« Dans les 30 derniers jours, tu as publié ceci : [titres/faits]. Si le sujet du jour contredit l'un d'eux, sors la contradiction explicitement. »*
3. Combiné à la recherche web (pour vérifier que l'ancienne déclaration est bien réelle), le cas Retailleau devient un **réflexe systématique** au lieu d'un coup de chance.

**Coût :** ~0 nouvelle IA, une table + une injection de prompt. C'est l'optimisation la plus rentable, et le premier test visible dès le test d'échelle.

---

## 4. La « vraie équipe » : l'orchestrateur — **Palier 2**

Pour passer au niveau « rédaction de presse », ce qui manque n'est pas une IA de plus qui écrit, c'est un **chef de desk** qui planifie et coordonne.

Aujourd'hui le pipeline traite chaque sujet isolément : il ne sait pas quelle est l'histoire du jour, ce qu'on a déjà couvert, ni quelle enquête il faut « suivre ».

**Le rôle de l'orchestrateur (1 appel par cycle, pas par article) :**

- Il lit les ~50 sujets ingérés + la mémoire éditoriale.
- Il décide : « aujourd'hui on traite X en **ALERTE**, Y en **DÉCRYPTAGE**, on **suit** Z parce que ça contredit la semaine dernière, et W on laisse tomber. »
- Il aiguille chaque sujet vers le bon format/angle, au lieu de laisser le tri seul décider.
- C'est lui qui gère la mémoire (publications, fils ouverts, contradictions repérées, suites d'enquête) et qui alimente les prompts des rédacteurs.

**Bonus économique :** ça coûte *moins* cher, pas plus — 1 gros appel de planification par cycle au lieu de tout rédiger à l'aveugle. Il filtre AVANT, donc on écrit moins de hors-sujet.

---

## 5. La suite logique : les « suites d'enquête » — **Palier 3**

Une fois que l'orchestrateur a la mémoire, il peut faire le travail d'un vrai desk d'investigation :

- Proposer des **rebonds** : « l'affaire X mérite un suivi la semaine prochaine ».
- Ouvrir des **fils** : repérer les promesses non tenues, les déclarations contradictoires, les dossiers qu'on a lâchés.
- Planifier sur le calendrier (qui existe déjà dans le labo).

---

## 6. La « team » idéale, en 3 étages

```
┌─────────────────────────────────────────────────────────┐
│ 1. ORCHESTRATEUR (chef de desk)                          │
│    fixe l'agenda · aiguille les sujets · suit les fils   │
│    repère les contradictions · gère la mémoire           │
├─────────────────────────────────────────────────────────┤
│ 2. RÉDACTION (l'éditorialiste actuel, thinking élevé)     │
│    écrit l'article avec la matière + la mémoire          │
│    + recherche web (vérification des faits)              │
├─────────────────────────────────────────────────────────┤
│ 3. MÉDIA / PUBLICATION (nœuds existants)                 │
│    images, diffusion (qoe.fi, réseaux…)                  │
└─────────────────────────────────────────────────────────┘
```

**Rappel important :** la Vérification a été absorbée par la Rédaction (le raisonnement + la recherche l'ont remplacée). Le pipeline reste donc à 7 nœuds ; l'orchestrateur s'ajoute *au-dessus*, pas en série dans la chaîne d'écriture.

---

## 7. Feuille de route recommandée

| Palier | Contenu | Coût | Effet visible |
|---|---|---|---|
| **1** | Mémoire éditoriale : table des publications/faits des 30 derniers jours + injection dans le prompt | Quasi nul (table + prompt) | Le cas « il se contredit » devient un réflexe ; moins de redites |
| **2** | Orchestrateur : appel de planification par cycle, aiguillage, gestion de la mémoire | 1 appel IA/cycle | Ça devient une « équipe » : agenda, formats, fils |
| **3** | Suites d'enquête : rebonds proposés par l'orchestrateur, fils ouverts, planification | Orchestrateur enrichi | L'investigation continue, on ne lâche plus les affaires |

---

## 8. Exigences transversales (le « chantier colossal »)

Pour que tout ça reste **modulable, contrôlable et testable de bout en bout**, on pose ces règles dès le départ :

- **Modulable** : chaque brique (mémoire, orchestrateur, suites) activable/désactivable via `daemon/config/config.yaml` + toggle dans le labo. Zéro rupture quand on désactive un palier.
- **Contrôlable** : pilotable depuis le labo (bouton « lancer un cycle », planification par cycle, choix des modèles par type), et pas de comportement magique — tout ce que l'orchestrateur décide doit être visible (une vue « agenda du jour »).
- **Testable de bout en bout** : tests Go par nœud (il y a déjà `*_test.go` sur content/researcher/gemini), fixtures déterministes pour la mémoire (injecter un passé fictif et vérifier que la contradiction ressort), et observabilité : chaque cycle journalisé (tables `daemon_cycles` / `daemon_cycle_steps` existantes) + télémétrie.
- **Budget maîtrisé** : la mémoire ne doit pas faire exploser le quota de recherche (une seule requête de vérification ciblée par contradiction suspectée, pas une recherche par fait).

---

## 9. État du ménage (fait en parallèle)

- **« ancien-labo » supprimé** : rien à supprimer, il n'existe plus dans le projet. L'ancien studio React (`app/(studio)`) et l'ancien radar TypeScript (`radar_lassez/`) ont déjà été retirés de l'arborescence ; seul `apps/labo` (Vue/Vite) subsiste, c'est le labo actuel.
- **`.gitignore` complété** : `past_convo.json` (transcript privé, 16 Mo), `daemon/logs/`, `scripts/fr.lassez.dev-daemon.plist`, `data/elections/`, `scratch/`, `.freebuff/`, `*.tsbuildinfo`, `*.log`, `.env*` non-example, `apps/labo/dist/`, `daemon/config/.secrets.yaml`, `daemon/config/*.bak`, etc.

---

## 10. Questions ouvertes (à trancher avant de coder)

1. **Fenêtre de mémoire** : 30 jours ? 90 ? Tout l'historique publié (avec priorité au récent) ?
2. **Granularité** : on injecte seulement les titres, ou des faits structurés (qui a dit quoi, quand, citation) ?
3. **Quels nœuds consomment la mémoire** : uniquement la rédaction, ou aussi le tri (pour prioriser un sujet qui contredit) et le validator (pour vérifier la cohérence) ?
4. **Où la stocker** : enrichir `daemon_publications` ou nouvelle table `daemon_memoire` (recommandé : table dédiée, plus flexible pour les faits) ?
5. **L'orchestrateur remplace-t-il le tri actuel ou le précède-t-il ?** (Recommandé : il précède/remplace le tri, le tri flash-lite devient inutile une fois l'orchestrateur en place — à valider sur les coûts.)
6. **Publication** : tant que qoe.fi n'est pas branché, la mémoire n'archive que les brouillons publiés en mock — OK ?
