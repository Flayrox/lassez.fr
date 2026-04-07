/**
 * RADAR SUBSYSTEM - SINGLE SOURCE OF TRUTH SCHEMA
 * Traces to REQ-SHARED-SCHEMA, REQ-UNI-NAMING
 */

export const RADAR_SCHEMA = {
    radar_posts: `
        CREATE TABLE IF NOT EXISTS radar_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_url TEXT UNIQUE NOT NULL,
            source_title TEXT NOT NULL,
            flash_content TEXT NOT NULL,
            image_keyword TEXT,
            status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED', 'IGNORED', 'FAILED')),
            wp_id INTEGER,
            geo TEXT DEFAULT 'france',
            tags TEXT DEFAULT '',
            punchline TEXT DEFAULT '',
            type_ouverture TEXT DEFAULT '📌 LE FAIT DU JOUR',
            fiabilite TEXT DEFAULT 'haute',
            video_path TEXT,
            approved_at DATETIME,
            scheduled_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    radar_settings: `
        CREATE TABLE IF NOT EXISTS radar_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `,
    radar_logs: `
        CREATE TABLE IF NOT EXISTS radar_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    radar_jobs: `
        CREATE TABLE IF NOT EXISTS radar_jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            status TEXT DEFAULT 'PENDING',
            payload TEXT,
            result TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    system_health: `
        CREATE TABLE IF NOT EXISTS system_health (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT NOT NULL
        );
    `,
    radar_social_drafts: `
        CREATE TABLE IF NOT EXISTS radar_social_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            image_url TEXT,
            status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'PUBLISHED')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    radar_nav_config: `
        CREATE TABLE IF NOT EXISTS radar_nav_config (
            slug TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            path TEXT NOT NULL,
            enabled INTEGER DEFAULT 1,
            badge TEXT,
            sort_order INTEGER DEFAULT 99
        );
    `
};

/**
 * Synchronizes the database schema.
 * Performs safe migrations by adding missing columns.
 * 
 * @param {any} db - A better-sqlite3 database instance
 */
export function syncDatabase(db) {
    if (!db) {
        throw new Error('[RADAR-SCHEMA] Database instance is required for synchronization.');
    }

    console.warn('⚠️ [RADAR-SCHEMA] Starting database synchronization.');
    console.warn('⚠️ [RADAR-SCHEMA] WARNING: Ensure you have a backup of your database before proceeding with migrations.');

    try {
        db.transaction(() => {
            // 1. Create tables if they don't exist
            for (const [tableName, createStatement] of Object.entries(RADAR_SCHEMA)) {
                db.exec(createStatement);
            }

            // 2. Safe Migrations: Add missing columns for radar_posts
            const postsCols = db.pragma('table_info(radar_posts)').map(c => c.name);
            
            const expectedPostsCols = {
                wp_id: 'INTEGER',
                geo: "TEXT DEFAULT 'france'",
                tags: "TEXT DEFAULT ''",
                punchline: "TEXT DEFAULT ''",
                type_ouverture: "TEXT DEFAULT '📌 LE FAIT DU JOUR'",
                fiabilite: "TEXT DEFAULT 'haute'",
                video_path: 'TEXT',
                approved_at: 'DATETIME',
                scheduled_at: 'DATETIME'
            };

            for (const [col, type] of Object.entries(expectedPostsCols)) {
                if (!postsCols.includes(col)) {
                    console.log(`  ↳ [MIGRATION] Adding column "${col}" to "radar_posts"`);
                    db.exec(`ALTER TABLE radar_posts ADD COLUMN ${col} ${type}`);
                }
            }

            // 3. Automatic updated_at trigger for radar_jobs
            db.exec(`
                CREATE TRIGGER IF NOT EXISTS update_radar_jobs_timestamp 
                AFTER UPDATE ON radar_jobs
                FOR EACH ROW
                BEGIN
                    UPDATE radar_jobs SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;
            `);

            // 4. FTS5 Table for archives (REQ-ARCHIVE-FTS)
            try {
                db.exec(`
                    CREATE VIRTUAL TABLE IF NOT EXISTS radar_archives USING fts5(
                        date_archive,
                        entite,
                        mots_cles,
                        declaration_brute,
                        source_url,
                        tokenize = 'porter unicode61'
                    );
                `);
            } catch (e) {
                console.warn('  ℹ️ [MIGRATION] FTS5 radar_archives skipped or already exists:', e.message);
            }
        })();
        
        console.log('✅ [RADAR-SCHEMA] Database synchronization complete.');
    } catch (error) {
        console.error('❌ [RADAR-SCHEMA] Synchronization failed:', error.message);
        throw error;
    }
}
