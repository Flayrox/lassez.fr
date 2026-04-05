const Database = require('better-sqlite3');
const path = require('path');
const { spawn } = require('child_process');

function getDb() {
    return new Database(path.join(__dirname, 'radar.db'));
}

function getSettings() {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM radar_settings').all();
    db.close();
    const s = {};
    for (const r of rows) s[r.key] = r.value;
    return s;
}

function saveSetting(key, value) {
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)').run(key, value);
    db.close();
}

function runScript(scriptName, args = []) {
    return new Promise((resolve) => {
        console.log(`[CRON] Exécution de ${scriptName}...`);
        const proc = spawn('node', [path.join(__dirname, scriptName), ...args], { stdio: 'inherit' });
        
        proc.on('close', () => resolve());
        proc.on('error', (err) => {
            console.error(`[CRON] Erreur sur ${scriptName}: ${err.message}`);
            resolve();
        });
        
        setTimeout(() => {
            proc.kill();
            console.error(`[CRON] Timeout pour ${scriptName}, processus tué.`);
            resolve();
        }, 15 * 60 * 1000);
    });
}

async function checkAndPublish() {
    const db = getDb();
    const posts = db.prepare(`SELECT id, source_url FROM radar_posts WHERE status = 'APPROVED' AND publish_after <= datetime('now') LIMIT 3`).all();
    db.close();
    
    if (posts.length > 0) {
        console.log(`[CRON] ${posts.length} flash(s) en attente de publication trouvés.`);
        for (const post of posts) {
            await runScript('publishPost.js', [post.id.toString(), post.source_url]);
        }
    } else {
        console.log(`[CRON] Aucun flash à publier.`);
    }
}

async function checkAndScan() {
    const settings = getSettings();
    const nextScanAtFile = settings.next_scan_at;
    const isAutoPilot = settings.auto_pilot === '1' || settings.auto_pilot === 'true';
    
    if (!isAutoPilot) {
        console.log(`[CRON] Le Pilote Automatique est désactivé. Aucun scan IA lancé.`);
        return;
    }

    if (!nextScanAtFile || new Date() >= new Date(nextScanAtFile)) {
        console.log(`[CRON] Il est l'heure de scanner les flux RSS !`);
        saveSetting('last_scan_at', new Date().toISOString());
        
        await runScript('index.js');
        
        const intervalHours = parseFloat(settings.scan_interval_hours || '2');
        const nextScanAt = new Date(Date.now() + intervalHours * 60 * 60 * 1000);
        saveSetting('next_scan_at', nextScanAt.toISOString());
        console.log(`[CRON] Scan terminé. Prochain scan programmé à : ${nextScanAt.toISOString()}`);
    } else {
        console.log(`[CRON] Pas encore l'heure du scan (Prochain à ${new Date(nextScanAtFile).toLocaleString()}).`);
    }
}

async function run() {
    console.log('════════════════════════════════════════');
    console.log(`📡 CRON RADAR L'ASSEZ — ${new Date().toLocaleString()}`);
    console.log('════════════════════════════════════════');
    
    await checkAndPublish();
    await checkAndScan();
    
    console.log('[CRON] Fin de la tâche. Extinction silencieuse.');
    process.exit(0);
}

run();
