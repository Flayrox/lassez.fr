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

const DAY_MAP = {
    'LUN': 1, 'MAR': 2, 'MER': 3, 'JEU': 4, 'VEN': 5, 'SAM': 6, 'DIM': 0,
    'MONDAY': 1, 'TUESDAY': 2, 'WEDNESDAY': 3, 'THURSDAY': 4, 'FRIDAY': 5, 'SATURDAY': 6, 'SUNDAY': 0
};

function parseDailySchedule(raw) {
    if (!raw) return [];
    // Formats supportés: "08:00", "LUN,MER 10:00", "LUN-VEN 09:00"
    return String(raw).split(/[\n;|\s]+/).map(x => x.trim()).filter(Boolean);
}

function getNextScheduledDate(scheduleEntries, now = new Date()) {
    if (!scheduleEntries.length) return null;

    const parsedSlots = scheduleEntries.map(entry => {
        // Séparer jours et heure (ex: "LUN,MER 10:00" -> days=["LUN","MER"], time="10:00")
        const parts = entry.split(/\s+/);
        let days = null; // null means all days
        let timeStr = parts[0];

        if (parts.length > 1) {
            days = parts[0].toUpperCase().split(',').map(d => DAY_MAP[d.trim()] ?? null).filter(d => d !== null);
            timeStr = parts[1];
        }

        const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        const h = Number(m[1]);
        const mm = Number(m[2]);
        if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;

        return { days, h, mm };
    }).filter(Boolean);

    if (!parsedSlots.length) return null;

    // On cherche dans les 7 prochains jours
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const day = new Date(now);
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() + dayOffset);
        const dayOfWeek = day.getDay();

        for (const slot of parsedSlots) {
            // Vérifier si le jour match
            if (slot.days && !slot.days.includes(dayOfWeek)) continue;

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
    if (settings.daemon_rss_enabled === 'false') {
        // Quiet mode if disabled
        return;
    }

    const now = new Date();
    log(`💓 Heartbeat: Checking triggers... (Schedule: ${settings.daemon_rss_schedule_enabled === 'true' ? 'ON' : 'OFF'}, Interval: ${settings.daemon_rss_interval_enabled !== 'false' ? 'ON' : 'OFF'})`);
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
        const dayOfWeek = now.getDay();
        const hitKey = `${toLocalDateKey(now)} ${minuteKey}`;
        const lastHit = settings.daemon_rss_schedule_last_hit || '';

        const hasMatch = scheduleTimes.some(entry => {
            const parts = entry.split(/\s+/);
            let days = null;
            let timeStr = parts[0];
            if (parts.length > 1) {
                days = parts[0].toUpperCase().split(',').map(d => DAY_MAP[d.trim()] ?? null).filter(d => d !== null);
                timeStr = parts[1];
            }
            if (timeStr !== minuteKey) return false;
            if (days && !days.includes(dayOfWeek)) return false;
            return true;
        });

        if (hasMatch && lastHit !== hitKey) {
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

// ─── SERVEUR DUMMY POUR HOSTINGER ─────────────────────────────
import http from 'http';
const dummyServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('DAEMON RSS IS ALIVE\n');
});
const port = process.env.PORT || 3006; 
dummyServer.listen(port, () => {
    log(`🌐 Serveur "Dummy" Hostinger démarré sur le port ${port}.`);
});

// Boucle principale: checke chaque minute (60s)
setInterval(checkAndRun, 60 * 1000);