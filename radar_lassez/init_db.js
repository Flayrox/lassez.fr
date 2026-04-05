import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'radar.db');

console.log(`Initialisation de la base de données SQLite à : ${dbPath}`);

const db = new Database(dbPath);

// ─── Table principale : posts radar ─────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS radar_posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url TEXT UNIQUE NOT NULL,
    source_title TEXT NOT NULL,
    flash_content TEXT NOT NULL,
    image_keyword TEXT,
    status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED', 'IGNORED', 'FAILED')),
    wp_id INTEGER,
    approved_at DATETIME,
    scheduled_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ─── Migrations : ajouter les colonnes manquantes si la DB existe déjà ─
const cols = db.pragma('table_info(radar_posts)').map(c => c.name);
if (!cols.includes('wp_id')) { db.exec(`ALTER TABLE radar_posts ADD COLUMN wp_id INTEGER`); console.log('  ↳ Colonne wp_id ajoutée.'); }
if (!cols.includes('approved_at')) { db.exec(`ALTER TABLE radar_posts ADD COLUMN approved_at DATETIME`); console.log('  ↳ Colonne approved_at ajoutée.'); }
if (!cols.includes('scheduled_at')) { db.exec(`ALTER TABLE radar_posts ADD COLUMN scheduled_at DATETIME`); console.log('  ↳ Colonne scheduled_at ajoutée.'); }

console.log('✅ Table radar_posts prête.');

// ─── Table des paramètres du radar ──────────────────────────
db.exec(`
CREATE TABLE IF NOT EXISTS radar_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`);

// Valeurs par défaut (INSERT OR IGNORE pour ne pas écraser les valeurs existantes)
const defaults = {
    max_articles: '3',     // Nombre max de bangers par cycle IA
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
    social_mastodon_enabled: 'true',
    social_bluesky_enabled: 'true',
    social_twitter_enabled: 'true',
    
    rss_feeds: JSON.stringify([
        'https://www.france24.com/en/rss',
        'https://www.rfi.fr/en/rss',
        'https://www.lemonde.fr/rss/une.xml',
        'https://www.mediapart.fr/articles/feed',
        'https://www.francetvinfo.fr/titres.rss',
        'https://www.humanite.fr/rss',
        'https://www.lefigaro.fr/rss/figaro_actualites.xml',
        'https://www.la-croix.com/RSS',
        'http://tempsreel.nouvelobs.com/rss.xml',
        'https://www.midilibre.fr/actu/politique/rss.xml',
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
        'https://www.blast-info.fr/rss.xml',
        'https://basta.media/spip.php?page=backend',
        'https://reporterre.net/spip.php?page=backend'
    ]),
    telegram_channels: JSON.stringify([
        'brevesdepresse',
        'AlertesInfos',
        'mediavenir'
    ]),
    ai_prompt: `Tu es le rédacteur en chef du média d'investigation indépendant "L'Assez". Ton IA est programmée pour être une arme de démystification politique radicale.
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

=== 4. FORMAT L'ASSEZ (TWEET/FLASH) ===
Pour chaque événement retenu, rédige un "Flash" ultra-percutant. Structure :
[Emojis] INFO - [Titre d'accroche DÉNONCIATEUR]
[Paragraphe factuel ACÉRÉ]
[Décryptage POLITIQUE RADICAL avec mise en contexte historique et petite pique cynique].`
};

const insertDefault = db.prepare(`INSERT OR IGNORE INTO radar_settings (key, value) VALUES (?, ?)`);
for (const [key, value] of Object.entries(defaults)) {
    insertDefault.run(key, value);
}

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

db.close();
console.log('');
console.log('🚀 Base de données prête. Tu peux démarrer le daemon avec :');
console.log('   pm2 start ecosystem.config.cjs');
