import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(path.join(__dirname, '..', 'radar_lassez', 'radar.db'));
const rows = db.prepare('SELECT key FROM radar_settings').all();
console.log(JSON.stringify(rows.map(r => r.key)));
db.close();
