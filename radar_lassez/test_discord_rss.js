import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, 'radar.db'));

console.log("🛠️  Activation temporaire du MODE TEST DISCORD...");
const originalSetting = db.prepare('SELECT value FROM radar_settings WHERE key = ?').get('discord_test_mode')?.value || 'false';

// Activer le mode test
db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)').run('discord_test_mode', 'true');

console.log("🚀 Lancement du scan RSS (index.js)...");
const child = spawn('node', ['index.js'], {
    cwd: __dirname,
    stdio: 'inherit'
});

child.on('close', (code) => {
    console.log(`\n🏁 Scan terminé avec le code ${code}.`);
    console.log(`🧹 Restauration du mode original (${originalSetting})...`);
    db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)').run('discord_test_mode', originalSetting);
    db.close();
    console.log("✅ Terminé.");
});
