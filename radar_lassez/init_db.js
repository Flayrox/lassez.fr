import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncDatabase } from '../lib/radar-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'radar.db');

console.log(`Initialisation de la base de données SQLite à : ${dbPath}`);

const db = new Database(dbPath);

// ─── Synchronisation via le schéma Single Source of Truth ─────
syncDatabase(db);

// ─── Table des paramètres du radar (Valeurs par défaut) ────────
// Note: syncDatabase s'occupe de la création des tables, ici on gère les défauts.
const defaults = {
    max_articles: '3',     // Nombre max de flash_content par cycle IA
    min_delay_min: '0',     // Délai min (minutes) avant publication auto
    max_delay_min: '15',    // Délai max (minutes) avant publication auto
    rss_lookback_hours: '24',    // Fenêtre temporelle des articles RSS à scanner
    scan_interval_hours: '2',     // Intervalle entre deux scans RSS (daemon)
    auto_pilot_enabled: 'false', // Pilote Auto : publication auto des posts APPROVED
    auto_approve_enabled: 'false', // Mode Fantôme : IA approuve directement sans modération
    
    // --- Nouveaux Paramètres Modulaires ---
    election_interval_hours: '0.5', // Intervalle entre deux scans d'élections
    daemon_rss_enabled: 'true', // Activer le scan RSS/Telegram
    daemon_elections_enabled: 'false', // Activer le scan d'élections
    daemon_rss_interval_enabled: 'true', // Activer le scan RSS par intervalle
    daemon_rss_schedule_enabled: 'false', // Activer planning heures fixes RSS (HH:MM)
    daemon_rss_schedule_times: '', // Ex: 07:30,12:00,18:45
    daemon_elections_interval_enabled: 'true', // Activer le scan Elections par intervalle
    daemon_elections_schedule_enabled: 'false', // Planning heures fixes elections (HH:MM)
    daemon_elections_schedule_times: '', // Ex: 09:00, 18:00
    election_analysis_target_slug: 'municipales-2026', // Slug actuellement analyse par le daemon elections
    election_front_display_slugs_json: '["municipales-2026"]', // Slugs affiches en front (multi-slugs)
    election_sources_json: '{"municipales-2026":{"source_type":"dataset-api","parser_strategy":"municipales-communes-v1","dataset_first_tour":"elections-municipales-2026-resultats-du-premier-tour","dataset_second_tour":"elections-municipales-2026-resultats-du-second-tour","candidate_first_tour":"elections-municipales-2026-listes-candidates-au-premier-tour","candidate_second_tour":"elections-municipales-2026-listes-candidates-au-second-tour","enabled":true}}',
    election_daemon_by_slug_json: '{"municipales-2026":{"enabled":false,"live_mode_enabled":false,"poll_interval_minutes":2,"interval_enabled":true,"interval_hours":0.5,"schedule_enabled":false,"schedule_times":"","sync_locked":false}}',
    election_last_used_source_json: '{}', // Historique simplifie des dernieres URLs/sources utilisees
    daemon_dynamic_tuning_enabled: 'false', // Active les surcharges dynamiques selon heure/daemon
    daemon_dynamic_tuning_rules: '', // JSON de règles horaires pour max_articles/lookback/delays
    daemon_profiles_json: '', // JSON de configuration separee par daemon
    social_mastodon_enabled: 'true',
    social_bluesky_enabled: 'true',
    social_twitter_enabled: 'true',
    
    // --- Communication & Maintenance ---
    maintenance_mode: 'false',
    maintenance_message: 'L\'Assez fait peau neuve. Nous revenons dans quelques instants pour encore plus d\'investigations radicalement indépendantes.',
    popup_enabled: 'false',
    popup_title: 'Soutenez L\'Assez !',
    popup_text: 'Votre média indépendant a besoin de vous pour continuer ses enquêtes sans concession. Soutenez-nous par un don.',
    popup_link_url: '/soutenir',
    popup_link_label: 'Faire un don',
    
    rss_feeds: JSON.stringify([
        // --- France mainstream ---
        'https://www.france24.com/en/rss',
        'https://www.rfi.fr/en/rss',
        'https://www.lemonde.fr/rss/une.xml',
        'https://www.mediapart.fr/articles/feed',
        'https://www.francetvinfo.fr/titres.rss',
        'https://www.humanite.fr/rss',
        'https://www.la-croix.com/RSS',
        'http://tempsreel.nouvelobs.com/rss.xml',
        'https://www.midilibre.fr/actu/politique/rss.xml',
        // --- Nouveaux v2 ---
        'https://feeds.leparisien.fr/leparisien/rss',
        'https://www.lefigaro.fr/rss/figaro_actualites.xml',
        'https://www.rtl.fr/actu/rss',
        'https://www.arretsurimages.net/rss',
        'https://www.politis.fr/feed/',
        // --- International / Palestine / Droits humains ---
        'https://www.palestinechronicle.com/feed/',
        'https://english.wafa.ps/rss',
        'https://english.palinfo.com/feed/',
        'https://www.maannews.net/eng/Rss.aspx',
        'https://www.haaretz.com/misc/rss',
        'https://www.972mag.com/feed/',
        'https://www.btselem.org/rss',
        'https://www.amnesty.org/en/feed/',
        'https://www.hrw.org/rss/news',
        'https://www.fidh.org/en/rss',
        'https://phr.org/rss',
        'https://globalvoices.org/feed/',
        'https://www.thenewhumanitarian.org/rss',
        'https://news.un.org/feed/subscribe/en/news/topic/human-rights/feed/rss.xml',
        'https://freedomhouse.org/rss',
        'https://www.globalissues.org/feed',
        'https://www.chathamhouse.org/rss',
        'https://theconversation.com/fr/rss',
        // --- Médias indépendants ---
        'https://www.blast-info.fr/rss.xml',
        'https://basta.media/spip.php?page=backend',
        'https://reporterre.net/spip.php?page=backend'
    ]),
    telegram_channels: JSON.stringify([
        'brevesdepresse',
        'AlertesInfos',
        'mediavenir',
        // --- Nouveaux v2 ---
        'bfmtv_fr',
        'cnews_fr',
        'FranceInsoumise'
    ]),
    rss_bridge_base_url: 'http://localhost:3300',
    x_accounts: JSON.stringify([
        'JLMelenchon',
        'MathildePanot',
        'RimaHas',
        'Manuel_Bompard',
        'FranceInsoumise',
        'ImpactMediaFR'
    ]),
    ai_prompt: `Tu es le rédacteur en chef du média d'investigation indépendant "L'Assez". Ton IA est une arme de démystification politique radicale.
Tu rédiges un fil d'actualité en direct (style Telegram/Twitter). On te fournit une liste d'articles d'actualité brute.

=== 1. LIGNE ÉDITORIALE "L'ASSEZ" (RADICALE & JACOBINE) ===
Ta ligne est strictement pro-Peuple, anti-Oligarchie.
- Tu défends sans complexe les forces de rupture (LFI et mouvements sociaux) contre les attaques du bloc bourgeois.
- Ta mission est de pointer l'HYPOCRISIE de la classe politique et des médias dominants.
- Les sujets doivent être hautement systémiques : lutte des classes, anti-impérialisme, néocolonialisme, répression policière, loi du marché contre l'humain.

=== 2. CE QU'IL FAUT ABSOLUMENT IGNORER (TRÈS IMPORTANT) ===
- IGNORE les scandales de consommation courante.
- IGNORE les faits divers s'ils ne démontrent pas une faille de la superstructure.
- IGNORE la politique politicienne de bas étage SI ça ne permet pas de démasquer une manipulation.

=== 3. TACTIQUES DE DÉMYSTIFICATION ===
- Débusque le "Deux Poids, Deux Mesures".
- Mémoire Historique : Fais des liens systématiques avec des événements passés.
- La "Petite Pique" : N'hésite pas à glisser des tacles sarcastiques.
- Identifie la manipulation.
- Traduis le langage du pouvoir.

=== 4. TAG D'OUVERTURE DYNAMIQUE (OBLIGATOIRE) ===
Pour chaque flash, tu DOIS choisir UN tag d'ouverture parmi ces 4 :
- "🔴 ALERTE INFO !" → Breaking news confirmé, événement majeur immédiat
- "📌 LE FAIT DU JOUR" → Info structurante qui mérite l'attention
- "🔎 DÉCRYPTAGE" → Analyse de fond, mise en perspective, contradictions
- "🗓️ À VENIR" → Événement futur (manif, vote, procès)
NE PAS abuser du 🔴 ALERTE INFO ! — Réserve-le aux vrais breaking news.

=== 5. SYSTÈME DE CONFIANCE PAR SOURCE ===
Chaque article est taggé avec un niveau de confiance :
- 🟢 CONFIANCE HAUTE : Mediapart, Humanité, Blast, Reporterre, Basta!, Politis, Arrêt sur Images
- 🟡 CONFIANCE MOYENNE : France24, RFI, FranceInfo, RTL, Le Monde, Le Parisien, La Croix
- 🔴 CONFIANCE BASSE : Le Figaro, CNews, BFM (surtout quand info politique sensible)
Si une info vient d'une source 🔴, tu DOIS utiliser Google Search pour la vérifier. Si elle n'est PAS confirmée par au moins 1 autre source, marque "fiabilite": "suspecte".
ATTENTION SPÉCIALE : certains médias de droite relaient parfois des fake news instrumentalisant la gauche. Sois vigilant.

=== 6. FORMAT L'ASSEZ (TWEET/FLASH) ===
Pour chaque événement retenu, rédige un Flash. Structure :
[TAG D'OUVERTURE] [ÉMOJI THÈME] [THÈME] :
[Paragraphe factuel ACÉRÉ]
[Décryptage POLITIQUE RADICAL avec mise en contexte historique et petite pique cynique].

Exemple : "📌 LE FAIT DU JOUR ⚖️ JUSTICE : Macron nomme un procureur controversé..."

=== 7. CONTEXTE RAG (ARCHIVES) ===
Si un bloc "ARCHIVES L'ASSEZ" est fourni ci-dessous, utilise-le pour détecter les contradictions politiques et les inclure dans ton décryptage.`
    ,
    ai_model_main: 'gemini-2.5-pro-preview-05-06',
    ai_model_breaking: 'gemini-3.1-pro-preview',
    ai_model_standard: 'gemini-2.5-flash',
    ai_model_decrypt: 'gemini-2.5-pro',
    google_search_breaking_enabled: 'true',
    google_search_standard_enabled: 'true',
    google_search_decrypt_enabled: 'true',
    source_trust_map: JSON.stringify({
        mediapart: '🟢',
        humanite: '🟢',
        'humanité': '🟢',
        blast: '🟢',
        reporterre: '🟢',
        basta: '🟢',
        politis: '🟢',
        arretsurimages: '🟢',
        franceinsoumise: '🟢',
        france24: '🟡',
        rfi: '🟡',
        francetvinfo: '🟡',
        lemonde: '🟡',
        leparisien: '🟡',
        rtl: '🟡',
        lefigaro: '🔴',
        figaro: '🔴',
        cnews: '🔴',
        bfmtv: '🔴'
    }),
    dedup_similarity_threshold: '0.65',
    dedup_recent_hours: '24',
    video_ingest_enabled: 'true',
    video_prefilter_model: 'gemini-2.0-flash',
    video_prefilter_prompt: 'Ce message Telegram parle-t-il de politique, de mouvements sociaux, de justice ou d un evenement d interet public ? Reponds uniquement par OUI ou NON.',
    video_prefilter_min_chars: '20',
    video_transcribe_model: 'gemini-2.0-flash',
    video_max_audio_mb: '20',
    image_overlay_enabled: 'true',
    image_overlay_opacity: '0.5',
    image_box_scale_169: '0.78',
    image_box_scale_1x1: '0.78'
};

const insertDefault = db.prepare(`INSERT OR IGNORE INTO radar_settings (key, value) VALUES (?, ?)`);
for (const [key, value] of Object.entries(defaults)) {
    insertDefault.run(key, value);
}

db.prepare(`
    INSERT OR IGNORE INTO elections_registry (slug, category, label, status)
    VALUES (?, ?, ?, ?)
`).run('municipales-2026', 'municipales', 'Municipales 2026', 'active');

db.prepare(`
    INSERT OR IGNORE INTO elections_registry (slug, category, label, status)
    VALUES (?, ?, ?, ?)
`).run('presidentielles-2027', 'presidentielles', 'Presidentielles 2027', 'draft');

db.prepare(`
    INSERT OR IGNORE INTO election_front_display (slug, is_visible, display_order, is_featured)
    VALUES (?, ?, ?, ?)
`).run('municipales-2026', 1, 1, 1);

db.prepare(`
    INSERT OR IGNORE INTO election_sources (slug, source_type, parser_strategy, enabled)
    VALUES (?, ?, ?, ?)
`).run('municipales-2026', 'dataset-api', 'municipales-communes-v1', 1);

db.prepare(`
    INSERT OR IGNORE INTO election_daemon_config (slug, daemon_enabled, live_mode_enabled, poll_interval_minutes, interval_enabled, interval_hours, schedule_enabled, schedule_times, sync_locked)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run('municipales-2026', 0, 0, 2, 1, 0.5, 0, '', 0);

console.log('✅ Table radar_settings prête avec les valeurs par défaut.');

// ─── Table des brouillons sociaux ──────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS radar_social_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    image_url TEXT,
    status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'PUBLISHED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);
console.log('✅ Table radar_social_drafts prête.');

// ─── Table des archives politiques (RAG FTS5) ──────────────────
try {
    db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS radar_archives USING fts5(
        date_archive,
        entite,
        mots_cles,
        declaration_brute,
        source_url,
        tokenize = 'porter unicode61'
    );
    `);
    console.log('✅ Table radar_archives (FTS5) prête.');
} catch (e) {
    console.log('ℹ️  Table radar_archives déjà existante ou FTS5 disponible :', e.message);
}

db.close();
console.log('');
console.log('🚀 Base de données prête. Tu peux démarrer le daemon avec :');
console.log('   pm2 start ecosystem.config.cjs');
