# À faire plus tard (backlog)

Tout ce qui est décidé en session mais pas encore implémenté. Coche au fur et à mesure.

## ⏳ En attente

- [ ] **Ingestion vidéo Telegram côté daemon** — le toggle « Activer l'ingestion vidéo » (page Sources → Vidéos Telegram) se sauvegarde mais ne fait rien : le daemon Go n'a aucun nœud vidéo (`videoIngestEnabled` est écrit dans les settings mais jamais consommé). Implémenter : pré-filtre IA (OUI/NON via `prefilterModel`), transcription via `transcribeModel`, limites `prefilterMinChars` / `maxAudioMb`.
- [ ] **Bouton « tester ce flux » par source** — lancer une aspiration isolée d'une URL depuis le tableau des sources et afficher le résultat (articles trouvés, erreurs) sans lancer le pipeline complet.
- [ ] **Suivi de santé par canal** — sur la page Sources, afficher pour chaque canal (Telegram, X, Google News, RSS-Bridge) le dernier passage, le nombre d'erreurs, les flux qui ont échoué (s'appuyer sur la table `daemon_source_health` déjà en place).

## 📝 Notes / décisions en attente

- [ ] **Vérifier la doc de l'opérationnel** : comptes X et chaînes Telegram nécessitent un serveur RSS-Bridge qui tourne (adresse dans Sources → Serveur RSS-Bridge, défaut `http://localhost:3300`). À documenter dans le README (comment l'installer/lancer).

## ✅ Fait récemment (mémoire)

- Autosave fiable avec indicateur visible dans la topbar (✓ Enregistré / Enregistrement… / erreur claire) + rattrapage auto quand le daemon revient.
- Modèles liés par leur NOM (pas l'ID API) — renommer un modèle ne casse plus les sélections.
- Mode édition ✎ sur Sources (URLs éditables) et modèles (Écriture).
- Ajout de sources en ligne « + » sans popup.
- Interrupteurs par canal (Telegram, X, Google News, RSS-Bridge, Vidéos) — un canal coupé = liste vide envoyée au daemon.
- Google News corrigé : les mots-clés deviennent l'URL RSS officielle de recherche (ça ne marchait pas avant).
- Comptes X et chaînes Telegram branchés sur le RSS-Bridge (TwitterBridge / TelegramBridge) — ils étaient silencieusement ignorés.
- Mode « Suivi » + journal du robot sur la page d'accueil (historique des cycles en SQLite, erreurs en rouge, logs en direct).
- Fix deadlock SQLite sur `/api/cycles`, fix erreur 400 sur PATCH identique, fix lien cassé « Lancer un scan ».
