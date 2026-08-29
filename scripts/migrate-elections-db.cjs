#!/usr/bin/env node
/**
 * Migration des bases : UN fichier SQLite par élection.
 *
 * Avant : tout vivait dans data/radar.db (signaux daemon_* + élections +
 * réglages legacy mélangés). Après :
 *   - data/radar.db            → pipeline uniquement (tables daemon_*)
 *   - data/elections/{slug}.db → UNE base par scrutin (officiel_cache,
 *                                resultats, sync_status + ses réglages)
 *   - data/elections/registry.json → quelles élections afficher + la cible
 *
 * Usage : node scripts/migrate-elections-db.cjs [--purge]
 *   --purge : après la copie, DROP les tables élections + legacy de radar.db.
 */
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const ROOT = path.join(__dirname, '..');
const OLD_DB = path.join(ROOT, 'data', 'radar.db');
const ELEC_DIR = path.join(ROOT, 'data', 'elections');
const REGISTRY_PATH = path.join(ELEC_DIR, 'registry.json');

const PURGE = process.argv.includes('--purge');

function getSettingsMap(db) {
    const hasSettings = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='radar_settings'"
    ).get();
    if (!hasSettings) return {};
    const rows = db.prepare('SELECT key, value FROM radar_settings').all();
    const map = {};
    for (const r of rows) map[String(r.key)] = String(r.value || '');
    return map;
}

function parseJson(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
}

function tableExists(db, name) {
    return !!db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(name);
}

function main() {
    if (!fs.existsSync(OLD_DB)) {
        console.error(`❌ Base introuvable : ${OLD_DB}`);
        process.exit(1);
    }
    const src = new Database(OLD_DB, { readonly: true });
    console.log(`📦 Source : ${OLD_DB}`);

    // ── 1. Lister les élections présentes (distinct election_slug) ──
    const slugs = [];
    if (tableExists(src, 'elections_officiel_cache')) {
        for (const r of src.prepare('SELECT DISTINCT election_slug FROM elections_officiel_cache').all()) {
            if (r.election_slug) slugs.push(String(r.election_slug));
        }
    }
    // Une élection déclarée dans les réglages mais sans données encore → on la crée quand même
    const settings = getSettingsMap(src);
    const declaredSlugs = parseJson(settings.election_front_display_slugs_json, []);
    for (const s of declaredSlugs) {
        if (s && !slugs.includes(String(s))) slugs.push(String(s));
    }
    if (!slugs.length) slugs.push('municipales-2026');

    console.log(`🗳️  Élections détectées : ${slugs.join(', ')}`);

    // ── 2. Créer le dossier + une base par élection ──
    fs.mkdirSync(ELEC_DIR, { recursive: true });

    const schemaStatements = [
        `CREATE TABLE IF NOT EXISTS elections_officiel_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_slug TEXT NOT NULL,
            code_departement TEXT,
            code_insee TEXT,
            ville TEXT NOT NULL,
            ville_norm TEXT,
            tour INTEGER NOT NULL,
            candidat TEXT NOT NULL,
            nuance TEXT,
            pct REAL NOT NULL,
            voix INTEGER,
            statut TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        )`,
        `CREATE INDEX IF NOT EXISTS idx_ville ON elections_officiel_cache(ville)`,
        `CREATE INDEX IF NOT EXISTS idx_ville_norm ON elections_officiel_cache(ville_norm)`,
        `CREATE INDEX IF NOT EXISTS idx_slug ON elections_officiel_cache(election_slug)`,
        `CREATE INDEX IF NOT EXISTS idx_v_d ON elections_officiel_cache(ville, code_departement)`,
        `CREATE INDEX IF NOT EXISTS idx_insee ON elections_officiel_cache(code_insee)`,
        `CREATE TABLE IF NOT EXISTS elections_resultats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_slug TEXT NOT NULL DEFAULT 'municipales-2026',
            ville TEXT NOT NULL,
            tour INTEGER NOT NULL DEFAULT 1,
            candidat TEXT NOT NULL,
            nuance TEXT,
            pct REAL NOT NULL DEFAULT 0,
            voix INTEGER DEFAULT 0,
            statut TEXT DEFAULT 'elimine' CHECK(statut IN ('elu', 'qualifie', 'elimine', 'retrait')),
            active INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(election_slug, ville, tour, candidat)
        )`,
        `CREATE TABLE IF NOT EXISTS elections_sync_status (
            election_slug TEXT PRIMARY KEY,
            last_sync TEXT
        )`,
        // Réglages SCOPÉS à cette élection (ex: sources data.gouv, dernière source utilisée)
        `CREATE TABLE IF NOT EXISTS election_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )`,
    ];

    const perSlugSettings = ['election_sources_json', 'election_last_used_source_json', 'election_daemon_by_slug_json'];

    for (const slug of slugs) {
        const dstPath = path.join(ELEC_DIR, `${slug}.db`);
        const dst = new Database(dstPath);
        for (const stmt of schemaStatements) dst.exec(stmt);

        // Copie des données officielles (filtrées par élection). Le script peut
        // être relancé : on vide la destination AVANT d'insérer (idempotent).
        // ⚠️ Si la source n'a plus la table (radar.db déjà purgée), on ne touche
        //    PAS à la destination — éviter d'écraser des données valides.
        if (tableExists(src, 'elections_officiel_cache')) {
            dst.prepare('DELETE FROM elections_officiel_cache').run();
            dst.prepare("DELETE FROM sqlite_sequence WHERE name='elections_officiel_cache'").run();
            const rows = src.prepare(
                'SELECT election_slug, code_departement, code_insee, ville, ville_norm, tour, candidat, nuance, pct, voix, statut, updated_at FROM elections_officiel_cache WHERE election_slug = ?'
            ).all(slug);
            const ins = dst.prepare(
                `INSERT INTO elections_officiel_cache
                 (election_slug, code_departement, code_insee, ville, ville_norm, tour, candidat, nuance, pct, voix, statut, updated_at)
                 VALUES (@election_slug, @code_departement, @code_insee, @ville, @ville_norm, @tour, @candidat, @nuance, @pct, @voix, @statut, @updated_at)`
            );
            const tx = dst.transaction((batch) => { for (const r of batch) ins.run(r); });
            for (let i = 0; i < rows.length; i += 500) tx(rows.slice(i, i + 500));
            console.log(`   ${slug} : ${rows.length} lignes officiel_cache`);
        }

        // Overrides manuels (radar-admin) — la table peut ne pas exister côté src
        if (tableExists(src, 'elections_resultats')) {
            dst.prepare('DELETE FROM elections_resultats').run();
            const rows = src.prepare('SELECT * FROM elections_resultats WHERE election_slug = ?').all(slug);
            if (rows.length) {
                const cols = Object.keys(rows[0]).filter(c => c !== 'id');
                const ins = dst.prepare(
                    `INSERT OR IGNORE INTO elections_resultats (${cols.join(',')}) VALUES (${cols.map(c => '@' + c).join(',')})`
                );
                const tx = dst.transaction((batch) => { for (const r of batch) ins.run(r); });
                tx(rows);
            }
        }

        // Statut de sync
        if (tableExists(src, 'elections_sync_status')) {
            const st = src.prepare('SELECT last_sync FROM elections_sync_status WHERE election_slug = ?').get(slug);
            if (st && st.last_sync) {
                dst.prepare('INSERT OR REPLACE INTO elections_sync_status (election_slug, last_sync) VALUES (?, ?)').run(slug, st.last_sync);
            }
        }

        // Réglages scopés à cette élection : on extrait la part du slug depuis les maps JSON globales
        for (const key of perSlugSettings) {
            const raw = settings[key];
            if (!raw) continue;
            const map = parseJson(raw, {});
            if (map && typeof map === 'object' && slug in map) {
                dst.prepare('INSERT OR REPLACE INTO election_settings (key, value) VALUES (?, ?)')
                    .run(key, JSON.stringify(map[slug]));
                console.log(`   ${slug} : réglage ${key} copié`);
            }
        }

        dst.close();
        console.log(`✅ ${dstPath} créée`);
    }

    // ── 3. Registry global (affichage + cible) ──
    const displaySlugs = parseJson(settings.election_front_display_slugs_json, []);
    const registry = {
        displaySlugs: displaySlugs.length ? displaySlugs : slugs,
        targetSlug: String(settings.election_analysis_target_slug || slugs[0] || 'municipales-2026'),
    };
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf-8');
    console.log(`📋 Registry : ${REGISTRY_PATH} → ${JSON.stringify(registry)}`);

    src.close();

    // ── 4. Purge de radar.db (optionnel) ──
    if (!PURGE) {
        console.log('\nℹ️  radar.db inchangée (lance avec --purge pour supprimer les tables élections + legacy).');
        return;
    }

    console.log('\n🧹 Purge de radar.db : suppression des tables élections + legacy...');
    const db = new Database(OLD_DB);
    const legacyTables = [
        // Élections (maintenant dans data/elections/)
        'elections_officiel_cache', 'elections_resultats', 'elections_sync_status',
        'elections_override', 'elections_registry', 'election_sources',
        'election_source_history', 'election_daemon_config', 'election_front_display',
        // Ancien radar (remplacé par daemon_*)
        'radar_posts', 'radar_logs', 'radar_jobs', 'radar_social_drafts',
        'radar_nav_config', 'radar_users', 'radar_password_resets', 'system_health',
        'radar_settings',
        // FTS5 archives (vide)
        'radar_archives', 'radar_archives_data', 'radar_archives_idx',
        'radar_archives_content', 'radar_archives_docsize', 'radar_archives_config',
    ];
    const dropped = [];
    for (const t of legacyTables) {
        if (tableExists(db, t)) {
            db.exec(`DROP TABLE IF EXISTS "${t}"`);
            dropped.push(t);
        }
    }
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    db.close();
    console.log(`🗑️  Tables supprimées : ${dropped.length ? dropped.join(', ') : '(aucune)'}`);

    // Recompaction
    const compact = new Database(OLD_DB);
    compact.exec('VACUUM');
    compact.close();
    const size = fs.statSync(OLD_DB).size;
    console.log(`✅ radar.db purgée et compactée (${(size / 1024 / 1024).toFixed(1)} Mo) — seules les tables daemon_* restent.`);
}

main();
