import { spawn } from 'child_process';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function log(msg) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log(`[${timestamp}] [DAEMON RSS] ${msg}`);
}

function getSettings() {
    try {
        const db = new Database(path.join(__dirname, 'radar.db'));
        const rows = db.prepare('SELECT key, value FROM radar_settings').all();
        db.close();
        return rows.reduce((acc, row) => {
            acc[row.key] = row.value;
            return acc;
        }, {});
    } catch (e) {
        log(`❌ Erreur lecture DB: ${e.message}`);
        return {};
    }
}

function saveSetting(key, value) {
    try {
        const db = new Database(path.join(__dirname, 'radar.db'));
        db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)').run(key, value);
        db.close();
    } catch (e) {
        log(`❌ Impossible de sauvegarder ${key}: ${e.message}`);
    }
}

function toLocalDateKey(d) {
    const pad2 = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toLocalHourMinute(d) {
    const pad2 = (n) => String(n).padStart(2, '0');
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function parseDailySchedule(raw) {
    if (!raw) return [];
    return String(raw).split(/[\n,;|\s]+/).map(x => x.trim()).filter(Boolean);
}

function getNextScheduledDate(scheduleTimes, now = new Date()) {
    if (!scheduleTimes.length) return null;
    const valid = scheduleTimes
        .map((hhmm) => {
            const m = String(hhmm).match(/^(\d{1,2}):(\d{2})$/);
            if (!m) return null;
            const h = Number(m[1]);
            const mm = Number(m[2]);
            if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
            return { h, mm };
        })
        .filter(Boolean);

    if (!valid.length) return null;

    for (let dayOffset = 0; dayOffset <= 1; dayOffset++) {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() + dayOffset);

        for (const slot of valid) {
            const candidate = new Date(day);
            candidate.setHours(slot.h, slot.mm, 0, 0);
            if (candidate > now) return candidate;
        }
    }

    return null;
}

function computeNextScanAt(settings, now = new Date()) {
    const scheduleEnabled = settings.daemon_rss_schedule_enabled === 'true';
    const scheduleTimes = parseDailySchedule(settings.daemon_rss_schedule_times);
    const intervalEnabled = settings.daemon_rss_interval_enabled !== 'false';
    const intervalHours = parseFloat(settings.scan_interval_hours || '2');

    const candidates = [];

    if (scheduleEnabled && scheduleTimes.length > 0) {
        const nextScheduled = getNextScheduledDate(scheduleTimes, now);
        if (nextScheduled) candidates.push(nextScheduled);
    }

    if (intervalEnabled && intervalHours > 0) {
        const lastScan = settings.last_scan_at ? new Date(settings.last_scan_at) : new Date(0);
        const nextByInterval = new Date(lastScan.getTime() + intervalHours * 60 * 60 * 1000);
        candidates.push(nextByInterval);
    }

    if (!candidates.length) return null;
    return new Date(Math.min(...candidates.map(d => d.getTime())));
}

let scanRunning = false;

function buildCustomConfig(settings) {
    // Lecture des paramètres spécifiques au Daemon RSS
    let types = ['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'];
    try {
        if (settings.daemon_rss_types) types = JSON.parse(settings.daemon_rss_types);
    } catch (e) {}

    return {
        model: settings.daemon_rss_model || 'gemini-3.1-pro-preview',
        types: types,
        count: parseInt(settings.daemon_rss_max_articles || settings.max_articles || '10', 10),
        lookbackHours: parseInt(settings.daemon_rss_lookback_hours || settings.rss_lookback_hours || '24', 10),
        prompt: settings.daemon_rss_prompt || '',
        saveDb: true // Le daemon enregistre toujours en BDD
    };
}

async function runScan(settings) {
    if (scanRunning) {
        log('⏭️ Scan déjà en cours, skip.');
        return;
    }
    scanRunning = true;
    log('════════════════════════════════════════');
    log('🔍 LANCEMENT DU SCAN RSS/TELEGRAM + IA');
    log('════════════════════════════════════════');

    saveSetting('last_scan_at', new Date().toISOString());

    const customConfig = buildCustomConfig(settings);
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const configFileName = `daemon_scan_${Date.now()}.json`;
    const configFilePath = path.join(tempDir, configFileName);
    fs.writeFileSync(configFilePath, JSON.stringify(customConfig, null, 2));

    try {
        log(`🎛️ Configuration appliquée: Modèle=${customConfig.model}, Articles=${customConfig.count}, Historique=${customConfig.lookbackHours}h`);
        
        await new Promise((resolve, reject) => {
            const child = spawn('node', ['index.js', '--config', `temp/${configFileName}`], {
                cwd: __dirname,
                env: { ...process.env, FORCE_COLOR: '0' },
                stdio: 'pipe',
                windowsHide: true
            });

            child.stdout.on('data', data => log(`[Node] ${data.toString().trim()}`));
            child.stderr.on('data', data => log(`[Node] ERR: ${data.toString().trim()}`));

            child.on('close', code => {
                if (code === 0) {
                    log(`✅ Script terminé avec succès.`);
                } else {
                    log(`⚠️ Script terminé avec code d'erreur ${code}.`);
                }
                resolve();
            });

            child.on('error', err => {
                log(`❌ Erreur exécution Node: ${err.message}`);
                resolve();
            });
        });
    } catch (e) {
        log(`❌ Erreur inattendue dans runScan: ${e.message}`);
    } finally {
        scanRunning = false;
        try { if (fs.existsSync(configFilePath)) fs.unlinkSync(configFilePath); } catch (e) {}
    }
}

function checkAndRun() {
    if (scanRunning) return;

    const settings = getSettings();
    if (settings.daemon_rss_enabled === 'false') return;

    const now = new Date();
    let shouldRun = false;

    const nextScanAt = computeNextScanAt(settings, now);
    if (nextScanAt) {
        saveSetting('next_scan_at', nextScanAt.toISOString());
    }

    // 1. HORAIRES SPÉCIFIQUES (Schedule)
    const scheduleEnabled = settings.daemon_rss_schedule_enabled === 'true';
    const scheduleTimes = parseDailySchedule(settings.daemon_rss_schedule_times);

    if (scheduleEnabled && scheduleTimes.length > 0) {
        const minuteKey = toLocalHourMinute(now);
        const hitKey = `${toLocalDateKey(now)} ${minuteKey}`;
        const lastHit = settings.daemon_rss_schedule_last_hit || '';

        if (scheduleTimes.includes(minuteKey) && lastHit !== hitKey) {
            saveSetting('daemon_rss_schedule_last_hit', hitKey);
            log(`⏰ Heure programmée atteinte : ${minuteKey}. Déclenchement du scan.`);
            shouldRun = true;
        }
    }

    // 2. INTERVALLE CLASSIQUE (Fallback si on ne matche pas un horaire fixe, ou si scheduleOff)
    const intervalEnabled = settings.daemon_rss_interval_enabled !== 'false';
    const intervalHours = parseFloat(settings.scan_interval_hours || '2');

    if (!shouldRun && intervalEnabled && intervalHours > 0) {
        const lastScan = settings.last_scan_at ? new Date(settings.last_scan_at) : new Date(0);
        const nextScanAt = new Date(lastScan.getTime() + intervalHours * 60 * 60 * 1000);
        
        if (now >= nextScanAt) {
            log(`⏳ Intervalle atteint (${intervalHours}h). Déclenchement du scan.`);
            shouldRun = true;
        }
    }

    if (shouldRun) {
        runScan(settings);
    }
}

// Lancement au démarrage de PM2 (Heartbeat info)
log('🚀 Radar L\'Assez : Daemon RSS initialisé.');
checkAndRun();

// Boucle principale: checke chaque minute (60s)
setInterval(checkAndRun, 60 * 1000);