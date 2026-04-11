import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'radar.db');

const db = new Database(dbPath);

console.log("Forcing update of source trust map in radar_settings...");

const DEFAULT_SOURCE_TRUST = {
    // 🟢 Confiance haute (Indépendants, Gauche, Droits Humains)
    'mediapart': '🟢', 'humanite': '🟢', 'humanité': '🟢', 'blast': '🟢', 'reporterre': '🟢',
    'basta': '🟢', 'politis': '🟢', 'arretsurimages': '🟢', 'arrêt sur images': '🟢',
    '972mag': '🟢', 'amnesty': '🟢', 'hrw': '🟢', 'btselem': '🟢', 'fidh': '🟢', 'phr': '🟢',
    'palestinechronicle': '🟢', 'wafa': '🟢', 'palinfo': '🟢', 'maannews': '🟢',
    'franceinsoumise': '🟢', 'jlmelenchon': '🟢', 'mathildepanot': '🟢', 'rimahas': '🟢',
    'manuel_bompard': '🟢', 'impactmediafr': '🟢',
    // 🟡 Confiance moyenne (Généralistes Mainstream)
    'france24': '🟡', 'rfi': '🟡', 'francetvinfo': '🟡', 'lemonde': '🟡',
    'leparisien': '🟡', 'lacroix': '🟡', 'la-croix': '🟡', 'rtl': '🟡',
    'nouvelobs': '🟡', 'midilibre': '🟡', 'globalvoices': '🟡', 'thenewhumanitarian': '🟡',
    'theconversation': '🟡', 'chathamhouse': '🟡', 'haaretz': '🟡', 'un.org': '🟡',
    'brevesdepresse': '🟡', 'alertesinfos': '🟡', 'mediavenir': '🟡',
    // 🔴 Confiance basse (Extrême-Droite, Réactionnaires, Sensationalisme)
    'lefigaro': '🔴', 'figaro': '🔴', 'cnews': '🔴', 'cnews_fr': '🔴', 'bfmtv': '🔴', 
    'bfm': '🔴', 'bfmtv_fr': '🔴', 'freedomhouse': '🔴',
};

db.prepare("REPLACE INTO radar_settings (key, value) VALUES ('source_trust_map', ?)").run(JSON.stringify(DEFAULT_SOURCE_TRUST, null, 2));

console.log("Source trust map updated successfully. Please refresh your Dashboard Settings page.");
db.close();
