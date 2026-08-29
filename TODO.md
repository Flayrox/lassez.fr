# À faire plus tard (backlog)

Tout ce qui est décidé en session mais pas encore implémenté. Coche au fur et à mesure.

## ⚠️ À savoir (quota niveau gratuit)

- ❌ **Clé AI Studio à sec** : Google répond « prepayment credits depleted » sur la clé — le rechargement n'est pas visible.
- ✅ **Vertex AI opérationnel** : compte de service configuré (projet `lassez-daemon`, région `global`) → `POST /api/vertex/test` = OK. Le pipeline bascule automatiquement sur Vertex quand AI Studio échoue, **avec la recherche web active**. Fixé : endpoint `global` sans préfixe + outil `googleSearch`.
- ⚠️ **Images d'articles** : le scraping Google Images était bloqué (0 image trouvée — Google bloque les clients non-navigateur). Corrigé : API Google officielle (Custom Search JSON API, 100 req/jour gratuites — clé à ajouter dans **Système → Recherche d'images**) + **repli Wikimedia Commons** (gratuit, sans clé, déjà actif). Filtre d'extensions (pas de PDF/SVG). Les ~73 anciens PENDING gardent leur mot-clé — re-enrichissables en repassant VALIDATED.
- ⚠️ **Quota de recherche Google épuisé** : le grounding `google_search` renvoie 429 sur le compte — le daemon réessaie sans grounding (repli auto), la recherche reprend au reset du quota.
- ⚠️ **`gemini-3.7-flash` hors quota sur le compte** : 429 → la rédaction **retombe automatiquement sur `gemini-3.5-flash-lite`** (repli code).
- ▶️ **Déblocage du backlog** : 470+ sujets INGESTED en attente — le tri traite 10-20 par cycle.

## ⏳ En attente

- [x] **Bouton « tester ce flux » par source** — bouton ▶ par ligne dans le tableau (Sources), endpoint `POST /api/sources/test` : aspiration isolée (flux RSS), aucun effet de bord. ✅
- [ ] **Suivi de santé par source** — sur la page Sources, afficher pour chaque source RSS le dernier passage, le nombre d'erreurs, les flux qui ont échoué (s'appuyer sur la table `daemon_source_health` déjà en place).

## 📝 Notes / décisions en attente

## 💡 Idées (brainstorm — pas encore priorisées)

- **Mémoire éditoriale** : injecter dans le prompt de rédaction les titres déjà publiés des 30 derniers jours — évite les redites, permet les « suites » d'enquêtes. Aujourd'hui chaque article est écrit sans savoir ce qui a déjà été publié.
- **Boucle de rétroaction humaine** : dans Signaux, un rejet rapide en 1 clic (« mauvais sujet / mal rédigé / doublon / hors ligne éditoriale ») qui alimente un réglage progressif des prompts.
- **🔒 Sécurité : binder l'API du daemon sur 127.0.0.1** — `LABO_API_ADDR` par défaut `:2506` écoute sur TOUTES les interfaces (exposé en prod si pas de pare-feu).
- **Retry intelligent JSON** : quand Gemini renvoie du JSON invalide, renvoyer le prompt avec l'erreur au lieu de laisser le sujet attendre le cycle suivant.
- **Priorisation par format** : dans la file de rédaction, traiter ALERTE avant INFO (les sujets graves d'abord).
- **Check des images avant publication** : HEAD request sur l'URL image pour ne pas publier d'image morte.
- **Budget recherche web par nœud** : toggle séparé tri / rédaction / vérification (le grounding coûte, un gros backlog peut faire exploser le budget).
- **Vue « déjà publié »** dans Signaux : filtre + lien vers l'article publié (qoe.fi).
- **Verrou de cycle** : empêcher deux cycles simultanés (scan manuel + programmé) de se marcher dessus.

## ✅ Fait récemment (mémoire)

- **Bases séparées : un fichier par élection** (`data/elections/{slug}.db`) + registre (`registry.json`) — les élections ne vivent plus dans `data/radar.db` (qui ne contient plus que les tables `daemon_*` du pipeline). La sync data.gouv écrit dans le fichier du scrutin, plus aucun verrou partagé avec le daemon. Migration : `scripts/migrate-elections-db.cjs [--purge]` (idempotent). Au passage, fix de 2 pages département cassées par Next 16 (`params` Promise non awaitées).
- **Studio restructuré en 3 sections** (Signaux · Front · Slide à venir) : menu latéral regroupé, nouvelle page **Élections** dans Front — CRUD complet des scrutins via le daemon (`GET/POST/PATCH/DELETE /api/elections`) : créer un scrutin (fichier `{slug}.db` + entrée registre + affichage), basculer affiché/cible, supprimer. Le registre ne se touche plus à la main.

- **Nœud Média réparé** (test pipeline) : Google Images officiel (Custom Search JSON API, optionnel) → Wikimedia Commons (repli gratuit sans clé) → filtre d'extensions. Les articles reçoivent enfin de vraies images.
- **JSON du compte de service Vertex masqué** dans Système (clé privée plus visible en clair).

- **Fallback Vertex AI** (daemon + studio) : nouveau provider dans `gemini_call.go` (auth par compte de service Google — JWT RS256 signé localement, échange OAuth2, token en cache), même structure de requête que AI Studio (grounding, température, schéma JSON). Chaîne de repli auto dans les 3 nœuds IA : AI Studio → Vertex. Endpoint `POST /api/vertex/test` pour valider le compte en un clic (même chemin que le pipeline). Carte « Vertex AI (secours) » dans Système (JSON du compte + région, défaut `global`). Tests : corps de requête Vertex camelCase + échange JWT complet sans réseau (RSA 2048, serveur factice).

- **Page « Pipeline » dans le labo** (menu Transforme) : les 7 nœuds détaillés étape par étape — ce qu'il fait, ce qui entre/sort (compteurs live), les réglages qui l'affectent, le modèle IA (température, recherche web) — + bandeau budget niveau gratuit (5 000 recherches/mois, 12 req/min) + lien « Expliquer → » depuis chaque étape de l'Atelier.
- **Répartition des modèles niveau gratuit** : Tri = `gemini-3.5-flash-lite`, Rédaction = `gemini-3.7-flash` (défaut), Vérification = `gemini-3.5-flash-lite`. Registry du labo limité aux modèles gratuits.
- **Replis automatiques anti-quota** (callGemini) : ① recherche web 429 → réessai sans grounding ; ② modèle 429 (3.7 flash hors quota) → repli `gemini-3.5-flash-lite`. Le pipeline ne stagne plus jamais sur un quota.
- **Prompt du Validator réécrit** : il exigeait un ton « neutre, clinique » (contradictoire avec le DNA scandalisé de L'Assez) et rejetait tous les brouillons — il valide maintenant la conformité au style L'Assez + faits + vocabulaire + amalgames + structure du format.

- **Recherche web RÉELLE à chaque appel IA** : grounding Google Search natif de l'API REST Gemini (`tools:[{google_search:{}}]` — le SDK Go ne l'expose pas, on appelle l'API directement). Le Tri, la Rédaction et la Vérification cherchent maintenant sur internet à chaque sujet (vérif des faits, passif des protagonistes).
- **Paramètres de génération verrouillés** : température 0.1 (Tri/Vérification, stricts) et 0.9 (Rédaction, créative), topP 0.9/0.95, maxOutputTokens 1024/8192/2048, candidateCount 1, sortie JSON structurée.
- **Prompts semi-dur côté daemon** : DNA complet (identité, mission GOOGLE SEARCH, vocabulaire, méthode des 3 Tirs intégrale) + consignes du format + template de secours — la base de référence si le YAML est vide.

- **Clé API Gemini gérable depuis le studio** (Système) : champ mot de passe → `.secrets.yaml`, statut actif/en pause, bouton « Tester la clé » (vrai appel Google via `POST /api/gemini/test`).
- **Les nœuds IA reçoivent enfin la matière première** : le researcher et l'éditorialiste ne voyaient que le titre du cluster (le mergedTopic persisté ne contenait ni excerpt ni source_content) — ils rédigent maintenant sur les extraits RSS + le **contenu complet** des 2 meilleures sources (go-readability), et le researcher reçoit le biais/confiance de chaque source (règle CRITICAL_CROSSCHECK opérationnelle).

- **Ingestion 100 % RSS** (daemon + labo) : suppression complète de Telegram, X, Google News, RSS-Bridge et de l'ingestion vidéo — le système d'import sera repensé plus tard, après modernisation de l'infra.
- Bouton « tester ce flux » ▶ par source (daemon `POST /api/sources/test` + modal de résultats dans le labo).

- Autosave fiable avec indicateur visible dans la topbar (✓ Enregistré / Enregistrement… / erreur claire) + rattrapage auto quand le daemon revient.
- Modèles liés par leur NOM (pas l'ID API) — renommer un modèle ne casse plus les sélections.
- Mode édition ✎ sur Sources (URLs éditables) et modèles (Écriture).
- Ajout de sources en ligne « + » sans popup.
- Interrupteurs par canal (Telegram, X, Google News, RSS-Bridge, Vidéos) — un canal coupé = liste vide envoyée au daemon.
- Google News corrigé : les mots-clés deviennent l'URL RSS officielle de recherche (ça ne marchait pas avant).
- Comptes X et chaînes Telegram branchés sur le RSS-Bridge (TwitterBridge / TelegramBridge) — ils étaient silencieusement ignorés.
- Mode « Suivi » + journal du robot sur la page d'accueil (historique des cycles en SQLite, erreurs en rouge, logs en direct).
- Fix deadlock SQLite sur `/api/cycles`, fix erreur 400 sur PATCH identique, fix lien cassé « Lancer un scan ».
