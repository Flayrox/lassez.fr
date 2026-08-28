# À faire plus tard (backlog)

Tout ce qui est décidé en session mais pas encore implémenté. Coche au fur et à mesure.

## ⏳ En attente

- [ ] **Ingestion vidéo Telegram côté daemon** — le toggle « Activer l'ingestion vidéo » (page Sources → Vidéos Telegram) se sauvegarde mais ne fait rien : le daemon Go n'a aucun nœud vidéo (`videoIngestEnabled` est écrit dans les settings mais jamais consommé). Implémenter : pré-filtre IA (OUI/NON via `prefilterModel`), transcription via `transcribeModel`, limites `prefilterMinChars` / `maxAudioMb`.
- [x] **Bouton « tester ce flux » par source** — bouton ▶ par ligne dans le tableau (Sources), endpoint `POST /api/sources/test` : aspiration isolée (normalisation Google News / X / Telegram incluse), aucun effet de bord. ✅
- [ ] **Suivi de santé par canal** — sur la page Sources, afficher pour chaque canal (Telegram, X, Google News, RSS-Bridge) le dernier passage, le nombre d'erreurs, les flux qui ont échoué (s'appuyer sur la table `daemon_source_health` déjà en place).

## 📝 Notes / décisions en attente

- [ ] **Vérifier la doc de l'opérationnel** : comptes X et chaînes Telegram nécessitent un serveur RSS-Bridge qui tourne (adresse dans Sources → Serveur RSS-Bridge, défaut `http://localhost:3300`). À documenter dans le README (comment l'installer/lancer).

## ✅ Fait récemment (mémoire)

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
