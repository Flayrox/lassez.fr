#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Migration unidirectionnelle des données du daemon Radar (SQLite / Prisma)
 * vers Payload (Postgres) — Phase 1 de l'unification.
 *
 * Lit la base SQLite `prisma/radar.db` (ou `radar_lassez/radar.db` en legacy)
 * et pousse chaque entité dans les collections Payload correspondantes :
 *   GlobalSettings     → global  radar-settings
 *   Source             → collection sources
 *   TaxonomyTemplate   → collection taxonomy-templates
 *   NewsTopic          → collection signals        (mapping d'IDs)
 *   Publication        → collection publications   (relation signal remappée)
 *   SeenUrl            → collection seen-urls
 *   Log                → collection logs           (100 derniers)
 *
 * Prérequis : compte admin Payload (PAYLOAD_BOT_EMAIL / PAYLOAD_BOT_PASSWORD
 * ou PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD) + PAYLOAD_API_URL
 * (ou PAYLOAD_SERVER_URL) dans l'environnement. Le compte admin doit exister.
 *
 * Usage :
 *   PAYLOAD_API_URL=https://api.lassez.fr/api/payload \
 *   PAYLOAD_BOT_EMAIL=bot@lassez.fr PAYLOAD_BOT_PASSWORD=*** \
 *   node scripts/migrate_radar_to_payload.cjs [--dry-run] [--db=prisma/radar.db]
 */
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });
const Database = require('better-sqlite3');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const dbArg = args.find(a => a.startsWith('--db='));
const DB_PATH = dbArg ? dbArg.slice('--db='.length) : path.join(process.cwd(), 'prisma', 'radar.db');

const API_BASE = (process.env.PAYLOAD_API_URL || process.env.PAYLOAD_SERVER_URL || 'http://localhost:5173').replace(/\/+$/, '')
    .replace(/\/api\/payload$/, '') + '/api/payload';
const ADMIN_EMAIL = process.env.PAYLOAD_ADMIN_EMAIL || process.env.PAYLOAD_BOT_EMAIL || 'bot@lassez.fr';
const ADMIN_PASSWORD = process.env.PAYLOAD_ADMIN_PASSWORD || process.env.PAYLOAD_BOT_PASSWORD || '';

let token = null;

async function login() {
    const res = await fetch(`${API_BASE}/authors/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Login Payload échoué (HTTP ${res.status}): ${text.slice(0, 300)}`);
    }
    const data = await res.json();
    if (!data.token) throw new Error('Aucun token JWT reçu');
    token = data.token;
    console.log(`✅ Connecté à ${API_BASE} (${ADMIN_EMAIL})`);
}

async function api(method, pathname, body) {
    const url = `${API_BASE}${pathname}`;
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${method} ${pathname}: ${text.slice(0, 300)}`);
    }
    return res.json();
}

function toJsonObject(raw, fallback) {
    if (raw === null || raw === undefined) return fallback;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return fallback; }
    }
    return raw;
}

const stats = { sources: 0, templates: 0, signals: 0, publications: 0, seenUrls: 0, logs: 0 };

async function migrate() {
    console.log(`🔌 Lecture de la base SQLite : ${DB_PATH}`);
    if (!require('fs').existsSync(DB_PATH)) {
        console.error(`❌ Base introuvable : ${DB_PATH}`);
        process.exit(1);
    }
    const db = new Database(DB_PATH, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);

    const hasLegacy = tables.includes('radar_posts');
    const hasPrisma = tables.includes('NewsTopic');
    if (!hasPrisma && !hasLegacy) {
        console.error('❌ Aucune table connue (ni Prisma ni legacy) dans cette base.');
        process.exit(1);
    }
    console.log(`ℹ️ Schéma détecté : ${hasPrisma ? 'Prisma (NewsTopic)' : 'legacy (radar_posts)'}`);

    if (!DRY_RUN) await login();

    // ============ 1. GlobalSettings → global radar-settings ============
    if (hasPrisma && tables.includes('GlobalSettings')) {
        const row = db.prepare('SELECT * FROM GlobalSettings ORDER BY id LIMIT 1').get();
        if (row) {
            const settings = { ...row };
            delete settings.id;
            // Les booléens SQLite arrivent en 0/1 : conversion en booléens JS.
            for (const key of Object.keys(settings)) {
                const v = settings[key];
                if (v === 0 || v === 1) {
                    settings[key] = v === 1;
                } else if (typeof v === 'number' || v === null || v === undefined) {
                    continue;
                } else {
                    settings[key] = String(v);
                }
            }
            delete settings.updatedAt;
            delete settings.createdAt;
            if (DRY_RUN) {
                console.log(`ℹ️ [dry-run] radar-settings : ${Object.keys(settings).length} champs à synchroniser`);
            } else {
                const existing = await api('GET', '/globals/radar-settings').catch(() => null);
                if (existing && existing.id) {
                    await api('POST', '/globals/radar-settings', settings);
                    console.log('✅ radar-settings mis à jour');
                } else {
                    await api('POST', '/globals/radar-settings', settings);
                    console.log('✅ radar-settings créé');
                }
            }
        }
    }

    // ============ 2. Source → sources ============
    if (hasPrisma && tables.includes('Source')) {
        const rows = db.prepare('SELECT * FROM Source').all();
        for (const row of rows) {
            if (DRY_RUN) { stats.sources++; continue; }
            try {
                await api('POST', '/sources', {
                    url: row.url,
                    type: row.type,
                    source_name: row.source_name,
                    source_bias: row.source_bias,
                    trust_score: row.trust_score,
                    allow_source_images: !!row.allowSourceImages,
                    active: row.active !== false,
                });
                stats.sources++;
            } catch (e) {
                // Doublon (unique url) : on met à jour à la place.
                const existing = await api('GET', `/sources?where[url][equals]=${encodeURIComponent(row.url)}&limit=1`).catch(() => ({ docs: [] }));
                if (existing.docs?.[0]) {
                    await api('PATCH', `/sources/${existing.docs[0].id}`, {
                        type: row.type,
                        source_name: row.source_name,
                        source_bias: row.source_bias,
                        trust_score: row.trust_score,
                        allow_source_images: !!row.allowSourceImages,
                        active: row.active !== false,
                    });
                    stats.sources++;
                } else {
                    console.error(`  ⚠️ Source ${row.url} : ${e.message}`);
                }
            }
        }
    }

    // ============ 3. TaxonomyTemplate → taxonomy-templates ============
    if (hasPrisma && tables.includes('TaxonomyTemplate')) {
        const rows = db.prepare('SELECT * FROM TaxonomyTemplate').all();
        for (const row of rows) {
            if (DRY_RUN) { stats.templates++; continue; }
            try {
                await api('POST', '/taxonomy-templates', {
                    name: row.name,
                    display_name: row.displayName,
                    description: row.description || '',
                    format_instructions: row.formatInstructions || row.promptText || '',
                    examples_json: toJsonObject(row.examplesJson, []),
                    output_schema_json: toJsonObject(row.outputSchemaJson, {}),
                    accent_color: row.accentColor || '#000000',
                    is_factory: !!row.isFactory,
                    active: row.active !== false,
                    sort_order: row.sortOrder || 0,
                });
                stats.templates++;
            } catch (e) {
                const existing = await api('GET', `/taxonomy-templates?where[name][equals]=${encodeURIComponent(row.name)}&limit=1`).catch(() => ({ docs: [] }));
                if (existing.docs?.[0]) {
                    await api('PATCH', `/taxonomy-templates/${existing.docs[0].id}`, {
                        display_name: row.displayName,
                        format_instructions: row.formatInstructions || row.promptText || '',
                        active: row.active !== false,
                        sort_order: row.sortOrder || 0,
                    });
                    stats.templates++;
                } else {
                    console.error(`  ⚠️ Template ${row.name} : ${e.message}`);
                }
            }
        }
    }

    // ============ 4. NewsTopic → signals (mapping d'IDs) ============
    const idMapping = new Map(); // ancien id Prisma → nouvel id Payload
    if (hasPrisma && tables.includes('NewsTopic')) {
        const rows = db.prepare('SELECT * FROM NewsTopic ORDER BY createdAt').all();
        for (const row of rows) {
            if (DRY_RUN) { stats.signals++; continue; }
            try {
                const rawData = toJsonObject(row.raw_data, {});
                const created = await api('POST', '/signals', {
                    source_title: rawData?.clusterTitle || rawData?.headline || 'Sujet sans titre',
                    raw_data: rawData,
                    final_draft: toJsonObject(row.final_draft, {}),
                    status: row.status || 'INGESTED',
                    taxonomy: row.taxonomy || null,
                    tags: toJsonObject(row.tags, []),
                    geo: row.geo || null,
                    image_url: row.image_url || null,
                    scheduled_at: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
                    published_at: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
                    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,
                    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : undefined,
                });
                if (created?.doc?.id) {
                    idMapping.set(String(row.id), created.doc.id);
                    stats.signals++;
                }
            } catch (e) {
                console.error(`  ⚠️ Signal ${row.id} : ${e.message}`);
            }
        }
        console.log(`✅ ${stats.signals} signals migrés`);
    }

    // ============ 5. Publication → publications (relation remappée) ============
    if (hasPrisma && tables.includes('Publication')) {
        const rows = db.prepare('SELECT * FROM Publication').all();
        for (const row of rows) {
            if (DRY_RUN) { stats.publications++; continue; }
            const newTopicId = idMapping.get(String(row.topicId));
            if (!newTopicId) {
                console.error(`  ⚠️ Publication ${row.id} : topic ${row.topicId} non migré, ignorée`);
                continue;
            }
            try {
                await api('POST', '/publications', {
                    signal: newTopicId,
                    platform: row.platform,
                    status: row.status || 'PENDING',
                    scheduled_at: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : new Date().toISOString(),
                    published_at: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
                });
                stats.publications++;
            } catch (e) {
                console.error(`  ⚠️ Publication ${row.id} : ${e.message}`);
            }
        }
    }

    // ============ 6. SeenUrl → seen-urls ============
    if (hasPrisma && tables.includes('SeenUrl')) {
        const rows = db.prepare('SELECT url FROM SeenUrl LIMIT 20000').all();
        if (DRY_RUN) {
            stats.seenUrls = rows.length;
        } else {
            for (const row of rows) {
                try {
                    await api('POST', '/seen-urls', { url: row.url });
                    stats.seenUrls++;
                } catch (e) {
                    // unique — doublon déjà présent, ok
                }
            }
        }
    }

    // ============ 7. Log → logs (100 derniers) ============
    if (hasPrisma && tables.includes('Log')) {
        const rows = db.prepare('SELECT * FROM Log ORDER BY timestamp DESC LIMIT 100').all();
        if (DRY_RUN) {
            stats.logs = rows.length;
        } else {
            for (const row of rows.reverse()) {
                try {
                    await api('POST', '/logs', {
                        level: row.level || 'INFO',
                        message: row.message,
                        node_id: row.nodeId || 'SYSTEM',
                        timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString(),
                    });
                    stats.logs++;
                } catch (e) {
                    // log best-effort
                }
            }
        }
    }

    db.close();

    console.log('\n📊 Récapitulatif :');
    console.log(`  sources: ${stats.sources}`);
    console.log(`  taxonomy-templates: ${stats.templates}`);
    console.log(`  signals: ${stats.signals}`);
    console.log(`  publications: ${stats.publications}`);
    console.log(`  seen-urls: ${stats.seenUrls}`);
    console.log(`  logs: ${stats.logs}`);
    console.log(DRY_RUN ? '\n(dry-run — rien n\'a été écrit)' : '\n✅ Migration terminée.');
}

migrate().catch((e) => {
    console.error('💥 Erreur fatale :', e.message);
    process.exit(1);
});
