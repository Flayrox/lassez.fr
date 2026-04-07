# 📑 RADAR v3.0 - Session du 06/04/2026 : Le Mécanicien OSINT
## 🚀 Résumé Global de la Session
Transformation du Radar en un Cortex IA d'investigation et d'automatisation complète.
### 1. Module OSINT & Vidéo (Infrastructure)
*   **Pipeline Vidéo Native** : Intégration de `yt-dlp` et `ffmpeg` sur le serveur. Le daemon peut maintenant extraire, télécharger et servir des vidéos natives (Telegram, Twitter, etc.).
*   **Transcription Auto** : Extraction audio et transcription pour que Gemini puisse "voir" le contenu des vidéos OSINT.
*   **API Vidéo Sécurisée** : Création d'une route spécifique `/api/radar/video` pour servir les fichiers `tmp-videos`.
### 2. Cerveau Électoral & RAG
*   **Mémoire Politique (FTS5)** : Ajout d'une base de données de recherche textuelle (`radar_archives`) pour que l'IA se souvienne des anciens flash_content et traque les contradictions.
*   **Cerveau v2 (Gemini 3.1)** : Le daemon utilise maintenant un clustering de doublons (tamis) pour économiser l'API et améliorer la pertinence.
### 3. Dashboard Admin v3 (UI Pro)
*   **Interface "Pro & Simple"** : Look Blanc/Indigo/Stone haut de gamme.
*   **Contrôles Avancés Restaurés** :
    *   **Daemon RSS / Élections** : Activables/Désactivables séparément.
    *   **Auto-Pilote & Auto-Approve** : Gestion de l'autonomie de l'IA (enfin ré-injectés dans l'onglet Maintenance !).
    *   **Timing Avancé** : Réglage du Scan Interval, Lookback RSS et Interval Élections.
    *   **Communication** : Gestion de la Maintenance, du Popup Flash et du menu de navigation.
 ---
## 🛠 Commandes de Déploiement & Maintenance
### Lancer en Local (PC)
1. `cd "d:\Admin\Downloads\Archive 2"`
2. `npm run dev`
3. Accès : `http://studio.localhost:5173/radar-admin`
### Déployer sur le VPS
1. `git push origin main`
2. Sur le serveur : `git pull` && `npm run build` && `pm2 restart all`
**Session terminée. Le système est stable, prêt pour ton nouveau CLI.**