# À faire plus tard (backlog)

Tout ce qui est décidé en session mais pas encore implémenté. Coche au fur et à mesure.

## ⚠️ À savoir (quota niveau gratuit)

- ✅ **Clé API valide** : la nouvelle clé (Système → Clé API Gemini) fonctionne — testée le 28/08 (réponse OK).
- ⚠️ **Quota de recherche Google épuisé** : le grounding `google_search` renvoie 429 (« quota dépassé ») sur le compte — les **5 000 recherches gratuites/mois** sont consommées. Le daemon a un **repli automatique** : il réessaie sans grounding (l'IA travaille sur la matière première), donc le pipeline tourne quand même. La recherche reprendra d'elle-même au prochain reset du quota.
- ⚠️ **`gemini-3.7-flash` hors quota sur le compte** : 429 même sans recherche → la rédaction **retombe automatiquement sur `gemini-3.5-flash-lite`** (repli code). Quand le compte y aura droit (ou plan payant), la rédaction repassera sur 3.7 Flash sans rien changer.
- ▶️ **Déblocage du backlog** : 470+ sujets INGESTED en attente — le tri traite 10-20 par cycle, tout se débloque progressivement.

## ⏳ En attente

- [ ] **Ingestion vidéo Telegram côté daemon** — le toggle « Activer l'ingestion vidéo » (page Sources → Vidéos Telegram) se sauvegarde mais ne fait rien : le daemon Go n'a aucun nœud vidéo (`videoIngestEnabled` est écrit dans les settings mais jamais consommé). Implémenter : pré-filtre IA (OUI/NON via `prefilterModel`), transcription via `transcribeModel`, limites `prefilterMinChars` / `maxAudioMb`.
- [x] **Bouton « tester ce flux » par source** — bouton ▶ par ligne dans le tableau (Sources), endpoint `POST /api/sources/test` : aspiration isolée (normalisation Google News / X / Telegram incluse), aucun effet de bord. ✅
- [ ] **Suivi de santé par canal** — sur la page Sources, afficher pour chaque canal (Telegram, X, Google News, RSS-Bridge) le dernier passage, le nombre d'erreurs, les flux qui ont échoué (s'appuyer sur la table `daemon_source_health` déjà en place).

## 📝 Notes / décisions en attente

- [ ] **Vérifier la doc de l'opérationnel** : comptes X et chaînes Telegram nécessitent un serveur RSS-Bridge qui tourne (adresse dans Sources → Serveur RSS-Bridge, défaut `http://localhost:3300`). À documenter dans le README (comment l'installer/lancer).

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

- **Page « Pipeline » dans le labo** (menu Transforme) : les 7 nœuds détaillés étape par étape — ce qu'il fait, ce qui entre/sort (compteurs live), les réglages qui l'affectent, le modèle IA (température, recherche web) — + bandeau budget niveau gratuit (5 000 recherches/mois, 12 req/min) + lien « Expliquer → » depuis chaque étape de l'Atelier.
- **Répartition des modèles niveau gratuit** : Tri = `gemini-3.5-flash-lite`, Rédaction = `gemini-3.7-flash` (défaut), Vérification = `gemini-3.5-flash-lite`. Registry du labo limité aux modèles gratuits.
- **Replis automatiques anti-quota** (callGemini) : ① recherche web 429 → réessai sans grounding ; ② modèle 429 (3.7 flash hors quota) → repli `gemini-3.5-flash-lite`. Le pipeline ne stagne plus jamais sur un quota.
- **Prompt du Validator réécrit** : il exigeait un ton « neutre, clinique » (contradictoire avec le DNA scandalisé de L'Assez) et rejetait tous les brouillons — il valide maintenant la conformité au style L'Assez + faits + vocabulaire + amalgames + structure du format.

- **Recherche web RÉELLE à chaque appel IA** : grounding Google Search natif de l'API REST Gemini (`tools:[{google_search:{}}]` — le SDK Go ne l'expose pas, on appelle l'API directement). Le Tri, la Rédaction et la Vérification cherchent maintenant sur internet à chaque sujet (vérif des faits, passif des protagonistes).
- **Paramètres de génération verrouillés** : température 0.1 (Tri/Vérification, stricts) et 0.9 (Rédaction, créative), topP 0.9/0.95, maxOutputTokens 1024/8192/2048, candidateCount 1, sortie JSON structurée.
- **Prompts semi-dur côté daemon** : DNA complet (identité, mission GOOGLE SEARCH, vocabulaire, méthode des 3 Tirs intégrale) + consignes du format + template de secours — la base de référence si le YAML est vide.

- **Clé API Gemini gérable depuis le studio** (Système) : champ mot de passe → `.secrets.yaml`, statut actif/en pause, bouton « Tester la clé » (vrai appel Google via `POST /api/gemini/test`).
- **Les nœuds IA reçoivent enfin la matière première** : le researcher et l'éditorialiste ne voyaient que le titre du cluster (le mergedTopic persisté ne contenait ni excerpt ni source_content) — ils rédigent maintenant sur les extraits RSS + le **contenu complet** des 2 meilleures sources (go-readability), et le researcher reçoit le biais/confiance de chaque source (règle CRITICAL_CROSSCHECK opérationnelle).

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
