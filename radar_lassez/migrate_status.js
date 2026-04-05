import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'radar.db');

const db = new Database(dbPath);

try {
    console.log('--- Migration du statut radar_posts ---');
    
    // 1. On commence une transaction pour la sécurité
    db.transaction(() => {
        // Obtenir le schéma actuel pour s'assurer qu'on ne casse rien
        const existingTable = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='radar_posts'").get();
        if (!existingTable) {
            console.log("Table radar_posts introuvable.");
            return;
        }

        console.log("Schéma actuel détecté. Mise à jour des contraintes de statut...");

        // 2. Renommer l'ancienne table
        db.exec("ALTER TABLE radar_posts RENAME TO radar_posts_old");

        // 3. Créer la nouvelle table avec la contrainte complète
        db.exec(`
        CREATE TABLE radar_posts (
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

        // 4. Copier les données de l'ancienne vers la nouvelle
        // Note: On liste explicitement les colonnes pour éviter tout souci si le schéma a divergé
        db.exec(`
        INSERT INTO radar_posts (id, source_url, source_title, flash_content, image_keyword, status, wp_id, approved_at, scheduled_at, created_at)
        SELECT id, source_url, source_title, flash_content, image_keyword, status, wp_id, approved_at, scheduled_at, created_at
        FROM radar_posts_old;
        `);

        // 5. Supprimer l'ancienne table
        db.exec("DROP TABLE radar_posts_old");
        
        console.log("✅ Migration réussie ! Le statut 'IGNORED' est maintenant autorisé.");
    })();
} catch (e) {
    console.error("❌ Erreur lors de la migration :", e.message);
} finally {
    db.close();
}
