import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const dbPath = path.join(__dirname, 'radar.db');
    const db = new Database(dbPath);

    console.log("=== DB STATUS BEFORE FIX ===");
    console.log('PENDING:', db.prepare("SELECT count(*) as c FROM radar_posts WHERE status='PENDING'").get().c);
    console.log('REJECTED:', db.prepare("SELECT count(*) as c FROM radar_posts WHERE status='REJECTED'").get().c);
    console.log('IGNORED:', db.prepare("SELECT count(*) as c FROM radar_posts WHERE status='IGNORED'").get().c);

    console.log("Wiping all history to force a clean rescan...");
    db.prepare("DELETE FROM radar_posts").run();

    console.log("=== DB STATUS AFTER FIX ===");
    console.log('PENDING:', db.prepare("SELECT count(*) as c FROM radar_posts WHERE status='PENDING'").get().c);
    console.log('REJECTED:', db.prepare("SELECT count(*) as c FROM radar_posts WHERE status='REJECTED'").get().c);
    console.log('IGNORED:', db.prepare("SELECT count(*) as c FROM radar_posts WHERE status='IGNORED'").get().c);

    db.close();
} catch (error) {
    console.error("Erreur de nettoyage de db:", error);
}
