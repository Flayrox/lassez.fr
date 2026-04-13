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
    `,
    radar_users: `
        CREATE TABLE IF NOT EXISTS radar_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin', 'editor', 'viewer')),
            permissions TEXT NOT NULL DEFAULT '{}',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    elections_registry: `
        CREATE TABLE IF NOT EXISTS elections_registry (
            slug TEXT PRIMARY KEY,
            category TEXT NOT NULL,
            label TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    election_front_display: `
        CREATE TABLE IF NOT EXISTS election_front_display (
            slug TEXT PRIMARY KEY,
            is_visible INTEGER NOT NULL DEFAULT 0,
            display_order INTEGER NOT NULL DEFAULT 99,
            is_featured INTEGER NOT NULL DEFAULT 0,
            hide_after_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    election_sources: `
        CREATE TABLE IF NOT EXISTS election_sources (
            slug TEXT PRIMARY KEY,
            source_url TEXT,
            source_type TEXT NOT NULL DEFAULT 'dataset-api',
            parser_strategy TEXT NOT NULL DEFAULT 'municipales-communes-v1',
            enabled INTEGER NOT NULL DEFAULT 1,
            last_status TEXT,
            last_error TEXT,
            last_fetched_at TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `,
    election_source_history: `
        CREATE TABLE IF NOT EXISTS election_source_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT NOT NULL,
            source_url TEXT,
            used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            run_id TEXT,
            checksum TEXT,
            row_count INTEGER DEFAULT 0,
            success INTEGER NOT NULL DEFAULT 0,
            error_message TEXT
        );
    `,
    election_daemon_config: `
        CREATE TABLE IF NOT EXISTS election_daemon_config (
            slug TEXT PRIMARY KEY,
            daemon_enabled INTEGER NOT NULL DEFAULT 0,
            live_mode_enabled INTEGER NOT NULL DEFAULT 0,
            poll_interval_minutes INTEGER NOT NULL DEFAULT 2,
            interval_enabled INTEGER NOT NULL DEFAULT 1,
            interval_hours REAL NOT NULL DEFAULT 0.5,
            schedule_enabled INTEGER NOT NULL DEFAULT 0,
            schedule_times TEXT NOT NULL DEFAULT '',
            sync_locked INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

            db.exec(`
                CREATE TRIGGER IF NOT EXISTS update_radar_users_timestamp
                AFTER UPDATE ON radar_users
                FOR EACH ROW
                BEGIN
                    UPDATE radar_users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
                END;
            `);

            db.exec(`
                CREATE TRIGGER IF NOT EXISTS update_elections_registry_timestamp
                AFTER UPDATE ON elections_registry
                FOR EACH ROW
                BEGIN
                    UPDATE elections_registry SET updated_at = CURRENT_TIMESTAMP WHERE slug = OLD.slug;
                END;
            `);

            db.exec(`
                CREATE TRIGGER IF NOT EXISTS update_election_front_display_timestamp
                AFTER UPDATE ON election_front_display
                FOR EACH ROW
                BEGIN
                    UPDATE election_front_display SET updated_at = CURRENT_TIMESTAMP WHERE slug = OLD.slug;
                END;
            `);

            db.exec(`
                CREATE TRIGGER IF NOT EXISTS update_election_sources_timestamp
                AFTER UPDATE ON election_sources
                FOR EACH ROW
                BEGIN
                    UPDATE election_sources SET updated_at = CURRENT_TIMESTAMP WHERE slug = OLD.slug;
                END;
            `);

            db.exec(`
                CREATE TRIGGER IF NOT EXISTS update_election_daemon_config_timestamp
                AFTER UPDATE ON election_daemon_config
                FOR EACH ROW
                BEGIN
                    UPDATE election_daemon_config SET updated_at = CURRENT_TIMESTAMP WHERE slug = OLD.slug;
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
