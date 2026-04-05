/**
 * ═══════════════════════════════════════════════════════════════
 *  RADAR L'ASSEZ — DAEMON AUTONOME
 *  À lancer UNE SEULE FOIS via PM2 sur le serveur Hostinger.
 *  PM2 le redémarre automatiquement en cas de crash.
 *
 *  Deux boucles parallèles :
 *  ┌──────────────────────────────────────────────────────────┐
 *  │ BOUCLE 1 : Scanner RSS/IA (toutes les N heures)          │
 *  │   → Scanne les flux RSS + Telegram                       │
 *  │   → Envoie à Gemini pour analyse                         │
 *  │   → Stocke les "bangers" en PENDING dans SQLite          │
 *  │   → Notifie via Discord                                  │
 *  ├──────────────────────────────────────────────────────────┤
 *  │ BOUCLE 2 : Publisheur anti-bot (toutes les minutes)      │
 *  │   → Cherche les posts APPROVED dans SQLite               │
 *  │   → Si le délai aléatoire est écoulé, publie sur WP      │
 *  │   → Lance publishPost.js pour chaque post dû             │
 *  └──────────────────────────────────────────────────────────┘
 *
 *  Tous les paramètres (intervalles, délais) sont lus depuis
 *  la table `radar_settings` dans radar.db — modifiable en
 *  temps réel depuis le Dashboard Web sans redémarrer le daemon.
 * ═══════════════════════════════════════════════════════════════
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Logging vers fichier + console ───────────────────────────
const LOG_PATH = path.join(__dirname, 'daemon.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 Mo max, puis rotation

function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}`;
    console.log(line);
    try {
        // Rotation si le fichier est trop gros
        if (fs.existsSync(LOG_PATH) && fs.statSync(LOG_PATH).size > MAX_LOG_BYTES) {
            fs.renameSync(LOG_PATH, LOG_PATH + '.old');
        }
        fs.appendFileSync(LOG_PATH, line + '\n');
    } catch (e) { /* ignore erreurs log */ }
}

// ─── Lecture des settings depuis la DB ───────────────────────────────────────────
function getSettings() {
    try {
        const db = new Database(path.join(__dirname, 'radar.db'), { readonly: true });
        const rows = db.prepare('SELECT key, value FROM radar_settings').all();
        db.close();
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        return settings;
    } catch (e) {
        log(`⚠️  Impossible de lire radar_settings: ${e.message}. Valeurs par défaut utilisées.`);
        return {};
    }
}

// ─── Sauvegarde de clés dans la DB settings ─────────────────────────────
function saveSetting(key, value) {
    try {
        const db = new Database(path.join(__dirname, 'radar.db'));
        db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)').run(key, value);
        db.close();
    } catch (e) {
        log(`⚠️  Impossible de sauvegarder ${key}: ${e.message}`);
    }
}

// ─── Exécution d'un script Node enfant  ───────────────────────
function runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, scriptName);
        log(`  ▶ Lancement de ${scriptName} ${args.join(' ')}...`);

        const child = spawn('node', [scriptPath, ...args], {
            cwd: __dirname,
            env: { ...process.env },
            stdio: 'pipe'
        });

        child.stdout.on('data', data => log(`  [${scriptName}] ${data.toString().trim()}`));
        child.stderr.on('data', data => log(`  [${scriptName}] ERR: ${data.toString().trim()}`));

        child.on('close', code => {
            if (code === 0) {
                log(`  ✅ ${scriptName} terminé avec succès.`);
                resolve();
            } else {
                log(`  ⚠️  ${scriptName} terminé avec code ${code}.`);
                resolve(); // On resolve quand même pour ne pas bloquer le daemon
            }
        });

        child.on('error', err => {
            log(`  ❌ Erreur de spawn pour ${scriptName}: ${err.message}`);
            resolve(); // Idem, on continue
        });

        // Timeout de sécurité : 20 minutes max par script
        setTimeout(() => {
            child.kill();
            log(`  ⏱️  Timeout atteint pour ${scriptName}, processus tué.`);
            resolve();
        }, 20 * 60 * 1000);
    });
}

// ─── BOUCLE 1 : Scan RSS/IA ───────────────────────────────────
let scanRunning = false;

async function runScan() {
    if (scanRunning) {
        log('⏭️  Scan déjà en cours, skip.');
        return;
    }
    scanRunning = true;
    log('════════════════════════════════════════');
    log('🔍 BOUCLE 1 — SCAN RSS/TELEGRAM + IA');
    log('════════════════════════════════════════');
    saveSetting('last_scan_at', new Date().toISOString());
    try {
        await runScript('index.js');
    } catch (e) {
        log(`❌ Erreur inattendue dans runScan: ${e.message}`);
    } finally {
        scanRunning = false;
        const settings = getSettings();
        const intervalHours = parseFloat(settings.scan_interval_hours || '2');
        const nextScanAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
        saveSetting('next_scan_at', nextScanAt.toISOString());
        log(`⏰ Prochain scan automatique prévu à ${nextScanAt.toLocaleTimeString('fr-FR')} (dans ${intervalHours}h).`);
    }
}

function startScanLoop() {
    setInterval(() => {
        if (scanRunning) return;
        const settings = getSettings();
        if (settings.daemon_rss_enabled === 'false') return;

        const nextScanAt = settings.next_scan_at ? new Date(settings.next_scan_at) : new Date(0);
        if (new Date() >= nextScanAt) {
            runScan();
        }
    }, 60 * 1000);

    // Initial check
    setTimeout(() => {
        log('🚀 Daemon RSS prêt. Premier check dans 5 secondes...');
        const settings = getSettings();
        if (settings.daemon_rss_enabled !== 'false') {
            const nextScanAt = settings.next_scan_at ? new Date(settings.next_scan_at) : new Date(0);
            if (new Date() >= nextScanAt) runScan();
        }
    }, 5000);
}

// ─── BOUCLE 2 : Publisheur anti-bot ───────────────────────────
let publishingIds = new Set(); // Pour éviter les doubles publications

async function runPublisher() {
    const settings = getSettings();
    const autoPilotEnabled = settings.auto_pilot_enabled === 'true';
    const minDelay = parseInt(settings.min_delay_min || '0', 10);
    const maxDelay = parseInt(settings.max_delay_min || '15', 10);

    let db;
    try {
        db = new Database(path.join(__dirname, 'radar.db'));

        // S'assurer que les colonnes nécessaires existent
        const cols = db.pragma(`table_info(radar_posts)`).map(c => c.name);
        if (!cols.includes('approved_at')) { db.exec(`ALTER TABLE radar_posts ADD COLUMN approved_at DATETIME`); log('📊 Colonne approved_at ajoutée.'); }
        if (!cols.includes('scheduled_at')) { db.exec(`ALTER TABLE radar_posts ADD COLUMN scheduled_at DATETIME`); log('📊 Colonne scheduled_at ajoutée.'); }
        if (!cols.includes('punchline')) { db.exec(`ALTER TABLE radar_posts ADD COLUMN punchline TEXT`); log('📊 Colonne punchline ajoutée.'); }

        if (!autoPilotEnabled) {
            // Pilote Auto OFF → on annule les scheduled_at existants pour éviter
            // que des posts soient publiés si quelqu'un réactive le pilote plus tard
            // (ils seront re-planifiés à ce moment-là avec un nouveau délai)
            const pending = db.prepare(`SELECT count(*) as c FROM radar_posts WHERE status = 'APPROVED'`).get();
            if (pending.c > 0) {
                log(`⚫ Pilote Auto désactivé. ${pending.c} post(s) APPROVED en attente de validation manuelle.`);
            }
            db.close();
            return;
        }

        log(`🟢 Pilote Auto actif. Vérification des publications programmées...`);

        // Assigner un scheduled_at aux posts APPROVED qui n'en ont pas encore
        const unscheduled = db.prepare(`
            SELECT id FROM radar_posts 
            WHERE status = 'APPROVED' AND scheduled_at IS NULL
        `).all();

        for (const post of unscheduled) {
            if (publishingIds.has(post.id)) continue;
            const delayMin = minDelay + Math.random() * (maxDelay - minDelay);
            const scheduledAt = new Date(Date.now() + delayMin * 60 * 1000);
            db.prepare(`UPDATE radar_posts SET scheduled_at = ? WHERE id = ?`)
                .run(scheduledAt.toISOString(), post.id);
            log(`📅 Post ID ${post.id} planifié dans ${delayMin.toFixed(1)} minutes (à ${scheduledAt.toLocaleTimeString('fr-FR')}).`);
        }

        // Publier les posts dont le scheduled_at est passé
        const dueNow = db.prepare(`
            SELECT id FROM radar_posts 
            WHERE status = 'APPROVED' 
            AND scheduled_at IS NOT NULL 
            AND datetime(scheduled_at) <= datetime('now')
        `).all();

        db.close();
        db = null;

        for (const post of dueNow) {
            if (publishingIds.has(post.id)) continue;
            publishingIds.add(post.id);
            log(`📤 Publication automatique du post ID ${post.id}...`);
            await runScript('publishPost.js', [String(post.id)]);
            publishingIds.delete(post.id);
        }

    } catch (e) {
        log(`❌ Erreur dans runPublisher: ${e.message}`);
    } finally {
        if (db) { try { db.close(); } catch (_) { } }
    }
}

function startPublisherLoop() {
    // Vérifie toutes les minutes s'il y a des posts à publier
    setInterval(() => {
        runPublisher();
    }, 60 * 1000);

    log('📡 Boucle de publication anti-bot démarrée (check toutes les minutes).');
}

// ─── BOUCLE 3 : Sync Élections ───────────
let electionRunning = false;

async function runElectionSync() {
    if (electionRunning) return;
    electionRunning = true;
    log('════════════════════════════════════════');
    log('🗳️  BOUCLE 3 — SYNC ÉLECTIONS');
    log('════════════════════════════════════════');
    try {
        await runScript('sync_elections.js');
    } catch (e) {
        log(`❌ Erreur dans runElectionSync: ${e.message}`);
    } finally {
        electionRunning = false;
        const settings = getSettings();
        const intervalHours = parseFloat(settings.election_interval_hours || '0.5');
        const nextScanAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
        saveSetting('next_election_scan_at', nextScanAt.toISOString());
        log(`⏰ Prochaine sync d'élections prévue à ${nextScanAt.toLocaleTimeString('fr-FR')} (dans ${intervalHours}h).`);
    }
}

function startElectionSyncLoop() {
    setInterval(() => {
        if (electionRunning) return;
        const settings = getSettings();
        if (settings.daemon_elections_enabled !== 'true') return;

        const nextScanAt = settings.next_election_scan_at ? new Date(settings.next_election_scan_at) : new Date(0);
        if (new Date() >= nextScanAt) {
            runElectionSync();
        }
    }, 60 * 1000);

    setTimeout(() => {
        log('🗳️  Daemon Élections prêt.');
        const settings = getSettings();
        if (settings.daemon_elections_enabled === 'true') {
            const nextScanAt = settings.next_election_scan_at ? new Date(settings.next_election_scan_at) : new Date(0);
            if (new Date() >= nextScanAt) runElectionSync();
        }
    }, 15000);
}

// ─── INIT DB : S'assure que les tables/settings existent ──────
function ensureDb() {
    const db = new Database(path.join(__dirname, 'radar.db'));

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

    db.exec(`
        CREATE TABLE IF NOT EXISTS radar_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    // Valeurs par défaut si elles n'existent pas encore
    const defaults = {
        max_articles: '3',
        min_delay_min: '0',
        max_delay_min: '15',
        rss_lookback_hours: '24',
        scan_interval_hours: '2',
        discord_test_mode: 'false',
        daemon_rss_enabled: 'true'
    };

    const insertDefault = db.prepare(`INSERT OR IGNORE INTO radar_settings (key, value) VALUES (?, ?)`);
    for (const [key, value] of Object.entries(defaults)) {
        insertDefault.run(key, value);
    }

    db.close();
    log('✅ Base de données vérifiée et prête.');
}

// ─── ENTRÉE PRINCIPALE ─────────────────────────────────────────
log('');
log('██████████████████████████████████████████████');
log('█  RADAR L\'ASSEZ — DAEMON v1.0               █');
log('█  Démarrage du service autonome...          █');
log('██████████████████████████████████████████████');
log('');

try {
    ensureDb();
} catch (e) {
    log(`❌ FATAL — Erreur d'initialisation de la DB: ${e.message}`);
    process.exit(1);
}

startPublisherLoop();
startScanLoop();
startElectionSyncLoop();

// ─── SERVEUR DUMMY POUR HOSTINGER ─────────────────────────────
// Hostinger (Phusion Passenger) TUE les applications Node.js qui n'ouvrent pas de port.
// Même si ceci est un daemon backend, on doit écouter sur un port pour passer le test de santé d'Hostinger.
const http = require('http');
const dummyServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('DAEMON IS ALIVE\n');
});
const port = process.env.PORT || 3001; // Hostinger injecte process.env.PORT
dummyServer.listen(port, () => {
    log(`🌐 Serveur "Dummy" Hostinger démarré sur le port ${port} pour maintenir le Daemon en vie.`);
});

// ─── Gestion propre de l'arrêt ────────────────────────────────
process.on('SIGTERM', () => {
    log('🛑 SIGTERM reçu. Arrêt propre du daemon.');
    dummyServer.close();
    process.exit(0);
});
process.on('SIGINT', () => {
    log('🛑 SIGINT reçu. Arrêt propre du daemon.');
    dummyServer.close();
    process.exit(0);
});
process.on('uncaughtException', (err) => {
    log(`❌ Exception non gérée: ${err.message}\n${err.stack}`);
});
process.on('unhandledRejection', (reason) => {
    log(`⚠️  Promise rejetée non gérée: ${reason}`);
});
