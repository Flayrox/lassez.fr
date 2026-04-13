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
 *  │   → Stocke les "flash_content" en PENDING dans SQLite   │
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
import http from 'http';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { syncDatabase } from '../lib/radar-schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─── Logging vers SQLite + Console ────────────────────────────
/**
 * Log a message to both console and the radar_logs table.
 * Traces to REQ-DB-LOGS.
 */
function log(msg, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${msg}`;
    console.log(line);
    
    let db;
    try {
        db = new Database(path.join(__dirname, 'radar.db'));
        db.prepare('INSERT INTO radar_logs (level, message) VALUES (?, ?)').run(level, msg);
        
        // Automated 7-day cleanup (approx. 1 week)
        db.prepare("DELETE FROM radar_logs WHERE created_at < datetime('now', '-7 days')").run();
        db.close();
    } catch (e) {
        // Fallback to console if DB fails
        if (db) try { db.close(); } catch(_) {}
    }
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

function pad2(n) {
    return String(n).padStart(2, '0');
}

function toLocalDateKey(d) {
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalHourMinute(d) {
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseDailySchedule(raw) {
    if (!raw) return [];
    const parts = String(raw)
        .split(/[\n,;|\s]+/)
        .map(x => x.trim())
        .filter(Boolean);

    const unique = new Set();
    for (const token of parts) {
        const m = token.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) continue;
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (h < 0 || h > 23 || min < 0 || min > 59) continue;
        unique.add(`${pad2(h)}:${pad2(min)}`);
    }
    return Array.from(unique).sort();
}

function getNextScheduledDate(scheduleTimes, now = new Date()) {
    if (!scheduleTimes.length) return null;

    for (let dayOffset = 0; dayOffset <= 2; dayOffset += 1) {
        const base = new Date(now);
        base.setHours(0, 0, 0, 0);
        base.setDate(base.getDate() + dayOffset);

        for (const hhmm of scheduleTimes) {
            const [h, m] = hhmm.split(':').map(Number);
            const candidate = new Date(base);
            candidate.setHours(h, m, 0, 0);
            if (candidate > now) return candidate;
        }
    }
    return null;
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
        const scheduleEnabled = settings.daemon_rss_schedule_enabled === 'true';
        const scheduleTimes = parseDailySchedule(settings.daemon_rss_schedule_times || '');

        if (scheduleEnabled && scheduleTimes.length > 0) {
            const nextScheduled = getNextScheduledDate(scheduleTimes);
            if (nextScheduled) {
                saveSetting('next_scan_at', nextScheduled.toISOString());
                log(`⏰ Prochain scan RSS programmé à ${nextScheduled.toLocaleTimeString('fr-FR')} (heures fixes: ${scheduleTimes.join(', ')}).`);
            }
        } else {
            const intervalHours = parseFloat(settings.scan_interval_hours || '2');
            const nextScanAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
            saveSetting('next_scan_at', nextScanAt.toISOString());
            log(`⏰ Prochain scan automatique prévu à ${nextScanAt.toLocaleTimeString('fr-FR')} (dans ${intervalHours}h).`);
        }
    }
}

function startScanLoop() {
    setInterval(() => {
        if (scanRunning) return;
        const settings = getSettings();
        if (settings.daemon_rss_enabled === 'false') return;

        const scheduleEnabled = settings.daemon_rss_schedule_enabled === 'true';
        const scheduleTimes = parseDailySchedule(settings.daemon_rss_schedule_times || '');

        if (scheduleEnabled && scheduleTimes.length > 0) {
            const now = new Date();
            const minuteKey = toLocalHourMinute(now);
            const hitKey = `${toLocalDateKey(now)} ${minuteKey}`;
            const lastHit = settings.daemon_rss_schedule_last_hit || '';

            const nextScheduled = getNextScheduledDate(scheduleTimes, new Date(now.getTime() + 60 * 1000));
            if (nextScheduled) {
                saveSetting('next_scan_at', nextScheduled.toISOString());
            }

            if (scheduleTimes.includes(minuteKey) && lastHit !== hitKey) {
                saveSetting('daemon_rss_schedule_last_hit', hitKey);
                runScan();
            }
            return;
        }

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
            const scheduleEnabled = settings.daemon_rss_schedule_enabled === 'true';
            const scheduleTimes = parseDailySchedule(settings.daemon_rss_schedule_times || '');
            if (scheduleEnabled && scheduleTimes.length > 0) {
                const now = new Date();
                const nextScheduled = getNextScheduledDate(scheduleTimes, new Date(now.getTime() + 60 * 1000));
                if (nextScheduled) {
                    saveSetting('next_scan_at', nextScheduled.toISOString());
                    log(`🗓️  Mode heures fixes actif (RSS): ${scheduleTimes.join(', ')}.`);
                }
                return;
            }

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

        if (!autoPilotEnabled) {
            // Pilote Auto OFF
            const pending = db.prepare(`SELECT count(*) as c FROM radar_posts WHERE status = 'APPROVED'`).get();
            if (pending.c > 0) {
                // On ne loggue plus toutes les minutes si c'est désactivé pour ne pas polluer
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
        log(`❌ Erreur dans runPublisher: ${e.message}`, 'ERROR');
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
        log(`❌ Erreur dans runElectionSync: ${e.message}`, 'ERROR');
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

// ─── BOUCLE 4 : Heartbeat ─────────────────────────────────────
/**
 * Updates the system_health table every 60s.
 * Traces to REQ-HB-MONITOR.
 */
function startHeartbeatLoop() {
    setInterval(() => {
        let db;
        try {
            db = new Database(path.join(__dirname, 'radar.db'));
            db.prepare("INSERT INTO system_health (id, last_heartbeat, status) VALUES (1, CURRENT_TIMESTAMP, 'ALIVE') ON CONFLICT(id) DO UPDATE SET last_heartbeat=CURRENT_TIMESTAMP, status='ALIVE'").run();
            db.close();
        } catch (e) {
            if (db) try { db.close(); } catch(_) {}
        }
    }, 60 * 1000);
    log('💓 Boucle de Heartbeat démarrée (check toutes les minutes).');
}

// ─── BOUCLE 5 : Job Processor ─────────────────────────────────
/**
 * Polls radar_jobs every 10s for manual triggers from UI.
 * Traces to REQ-JOB-SYNC.
 */
let jobRunning = false;
async function processJobs() {
    if (jobRunning) return;
    let db;
    try {
        db = new Database(path.join(__dirname, 'radar.db'));
        const job = db.prepare("SELECT * FROM radar_jobs WHERE status = 'PENDING' LIMIT 1").get();
        
        if (job) {
            jobRunning = true;
            log(`🛠️ Traitement du job ID ${job.id} (Type: ${job.type})...`);
            db.prepare("UPDATE radar_jobs SET status = 'RUNNING' WHERE id = ?").run(job.id);
            db.close();
            db = null;

            try {
                if (job.type === 'MANUAL_SCAN') {
                    await runScan();
                } else if (job.type === 'ELECTION_SYNC') {
                    await runElectionSync();
                }
                
                db = new Database(path.join(__dirname, 'radar.db'));
                db.prepare("UPDATE radar_jobs SET status = 'COMPLETED', result = ? WHERE id = ?").run('Success', job.id);
            } catch (err) {
                log(`❌ Échec du job ID ${job.id}: ${err.message}`, 'ERROR');
                if (!db) db = new Database(path.join(__dirname, 'radar.db'));
                db.prepare("UPDATE radar_jobs SET status = 'FAILED', result = ? WHERE id = ?").run(err.message, job.id);
            }
        }
    } catch (e) {
        log(`⚠️ Erreur Job Processor: ${e.message}`, 'ERROR');
    } finally {
        jobRunning = false;
        if (db) try { db.close(); } catch(_) {}
    }
}

function startJobLoop() {
    setInterval(() => processJobs(), 10 * 1000);
    log('⚙️ Boucle de gestion des Jobs démarrée (check toutes les 10s).');
}

// ─── INIT DB : S'assure que les tables/settings existent ──────
function ensureDb() {
    const db = new Database(path.join(__dirname, 'radar.db'));

    // Synchronisation via le schéma SSOT
    syncDatabase(db);

    // Valeurs par défaut si elles n'existent pas encore
    const defaults = {
        max_articles: '3',
        min_delay_min: '0',
        max_delay_min: '15',
        rss_lookback_hours: '24',
        scan_interval_hours: '2',
        discord_test_mode: 'false',
        daemon_rss_enabled: 'true',
        daemon_rss_schedule_enabled: 'false',
        daemon_rss_schedule_times: '',
        auto_pilot_enabled: 'true',
        ai_model_main: 'gemini-2.5-pro-preview-05-06',
        source_trust_map: '{"mediapart":"🟢","france24":"🟡","lefigaro":"🔴"}',
        dedup_similarity_threshold: '0.65',
        dedup_recent_hours: '24',
        video_ingest_enabled: 'true',
        video_prefilter_model: 'gemini-2.0-flash',
        video_prefilter_prompt: 'Ce message Telegram parle-t-il de politique, de mouvements sociaux, de justice ou d un evenement d interet public ? Reponds uniquement par OUI ou NON.',
        video_prefilter_min_chars: '20',
        video_transcribe_model: 'gemini-2.0-flash',
        video_max_audio_mb: '20'
    };

    const insertDefault = db.prepare(`INSERT OR IGNORE INTO radar_settings (key, value) VALUES (?, ?)`);
    for (const [key, value] of Object.entries(defaults)) {
        insertDefault.run(key, value);
    }

    db.close();
    log('✅ Base de données vérifiée et prête via syncDatabase.');
}

// ─── ENTRÉE PRINCIPALE ─────────────────────────────────────────
log('');
log('██████████████████████████████████████████████');
log('█  RADAR L\'ASSEZ — DAEMON v2.0               █');
log('█  Démarrage du service autonome harmonisé... █');
log('██████████████████████████████████████████████');
log('');

try {
    ensureDb();
} catch (e) {
    log(`❌ FATAL — Erreur d'initialisation de la DB: ${e.message}`, 'ERROR');
    process.exit(1);
}

startPublisherLoop();
startScanLoop();
startElectionSyncLoop();
startHeartbeatLoop();
startJobLoop();

// ─── SERVEUR DUMMY POUR HOSTINGER ─────────────────────────────
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
