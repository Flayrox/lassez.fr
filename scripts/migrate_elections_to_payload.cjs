#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Migration one-shot : élections legacy SQLite → collection Payload "elections".
 *
 * Fusionne les tables legacy (elections_registry, election_sources,
 * election_daemon_config, election_front_display) et les réglages
 * (election_sources_json, election_daemon_by_slug_json,
 * election_last_used_source_json) en un document Payload par scrutin.
 *
 * Usage :
 *   node scripts/migrate_elections_to_payload.cjs [--db=path] [--dry-run]
 *
 * Prérequis : PAYLOAD_BOT_EMAIL / PAYLOAD_BOT_PASSWORD (+ PAYLOAD_API_URL).
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const { DatabaseSync } = require('node:sqlite');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const dbArg = args.find((a) => a.startsWith('--db='));
const DB_PATH = dbArg ? dbArg.slice('--db='.length) : path.join(process.cwd(), 'data', 'radar.db');

const API_BASE = (process.env.PAYLOAD_API_URL || process.env.PAYLOAD_SERVER_URL || 'http://localhost:5173')
    .replace(/\/+$/, '')
    .replace(/\/api\/payload$/, '') + '/api/payload';
const ADMIN_EMAIL = process.env.PAYLOAD_BOT_EMAIL || 'bot@lassez.fr';
const ADMIN_PASSWORD = process.env.PAYLOAD_BOT_PASSWORD || '';

let token = null;

async function login() {
    const res = await fetch(`${API_BASE}/authors/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Login Payload échoué (HTTP ${res.status})`);
    const data = await res.json();
    if (!data.token) throw new Error('Aucun token JWT reçu');
    token = data.token;
    console.log(`✅ Connecté à ${API_BASE} (${ADMIN_EMAIL})`);
}

async function api(method, pathname, body) {
    const res = await fetch(`${API_BASE}${pathname}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `JWT ${token}` },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${method} ${pathname}: ${text.slice(0, 400)}`);
    }
    return res.json();
}

function parseJson(raw, fallback) {
    if (raw === null || raw === undefined || raw === '') return fallback;
    try { return JSON.parse(raw); } catch { return fallback; }
}

const ROLE_TO_FIELD = {
    results_first_tour: 'dataset_first_tour',
    results_second_tour: 'dataset_second_tour',
    candidates_first_tour: 'candidate_first_tour',
    candidates_second_tour: 'candidate_second_tour',
};

async function main() {
    console.log(`🔌 Lecture de la base SQLite : ${DB_PATH}`);
    if (!fs.existsSync(DB_PATH)) throw new Error(`Base introuvable : ${DB_PATH}`);
    const db = new DatabaseSync(DB_PATH, { readOnly: true });

    const registry = db.prepare('SELECT * FROM elections_registry').all();
    console.log(`ℹ️ ${registry.length} scrutins dans le registre legacy`);

    const sources = db.prepare('SELECT * FROM election_sources').all();
    const daemonCfg = db.prepare('SELECT * FROM election_daemon_config').all();
    const frontDisplay = db.prepare('SELECT * FROM election_front_display').all();

    const settings = db.prepare('SELECT key, value FROM radar_settings').all();
    const getSetting = (k) => {
        const r = settings.find((s) => s.key === k);
        return r ? r.value : null;
    };
    const sourcesJson = parseJson(getSetting('election_sources_json'), {});
    const daemonJson = parseJson(getSetting('election_daemon_by_slug_json'), {});
    const lastUsedJson = parseJson(getSetting('election_last_used_source_json'), {});

    const existing = DRY_RUN ? [] : (await login().then(() => api('GET', '/elections?limit=1000&depth=0'))).docs;
    const existingSlugs = new Set(existing.map((e) => String(e.slug || '').toLowerCase()));

    let created = 0;
    let updated = 0;

    for (const reg of registry) {
        const slug = String(reg.slug || '').trim();
        if (!slug) continue;

        const src = sources.find((s) => s.slug === slug) || {};
        const daemon = daemonCfg.find((d) => d.slug === slug) || {};
        const front = frontDisplay.find((f) => f.slug === slug) || {};
        const srcCfg = sourcesJson[slug] || {};
        const daemonCfgJson = daemonJson[slug] || {};
        const lastUsed = lastUsedJson[slug] || {};

        // Jeux de données : fusion des slugs config (dataset_*_tour) et des URLs du dernier import.
        const datasets = [];
        for (const [role, field] of Object.entries(ROLE_TO_FIELD)) {
            const datasetSlug = String(srcCfg[field] || '').trim();
            if (!datasetSlug) continue;
            const urlField = {
                dataset_first_tour: 'results_first_tour_url',
                dataset_second_tour: 'results_second_tour_url',
                candidate_first_tour: 'candidatures_first_tour_url',
                candidate_second_tour: 'candidatures_second_tour_url',
            }[field];
            datasets.push({
                role,
                dataset_slug: datasetSlug,
                last_url: String(lastUsed[urlField] || '') || null,
                last_success: Boolean(lastUsed.success),
                last_error: null,
            });
        }

        const payload = {
            label: String(reg.label || slug).trim(),
            slug,
            category: String(reg.category || 'autre'),
            status: reg.status === 'active' ? 'active' : 'draft',
            source_type: String(src.source_type || srcCfg.source_type || 'dataset-api'),
            parser_strategy: String(src.parser_strategy || srcCfg.parser_strategy || '') || null,
            datasets,
            daemon_enabled: Boolean(daemon.daemon_enabled ?? daemonCfgJson.enabled),
            live_mode_enabled: Boolean(daemon.live_mode_enabled ?? daemonCfgJson.live_mode_enabled),
            sync_locked: Boolean(daemon.sync_locked ?? daemonCfgJson.sync_locked),
            interval_enabled: Boolean(daemon.interval_enabled ?? daemonCfgJson.interval_enabled),
            interval_hours: Number(daemon.interval_hours ?? daemonCfgJson.interval_hours ?? 0.5),
            poll_interval_minutes: Number(daemon.poll_interval_minutes ?? daemonCfgJson.poll_interval_minutes ?? 2),
            schedule_enabled: Boolean(daemon.schedule_enabled ?? daemonCfgJson.schedule_enabled),
            schedule_times: String(daemon.schedule_times ?? daemonCfgJson.schedule_times ?? '') || null,
            is_visible: Boolean(front.is_visible ?? 1),
            is_featured: Boolean(front.is_featured ?? 0),
            display_order: Number(front.display_order ?? 1),
            hide_after_date: front.hide_after_date ? new Date(front.hide_after_date).toISOString() : null,
        };

        if (DRY_RUN) {
            console.log(`  [dry-run] ${slug} → « ${payload.label} » (${payload.category}, ${payload.status}, ${datasets.length} dataset(s))`);
            created++;
            continue;
        }

        if (existingSlugs.has(slug.toLowerCase())) {
            const doc = existing.find((e) => String(e.slug || '').toLowerCase() === slug.toLowerCase());
            await api('PATCH', `/elections/${doc.id}`, payload);
            console.log(`✏️  ${slug} mis à jour (#${doc.id})`);
            updated++;
        } else {
            const doc = await api('POST', '/elections', payload);
            console.log(`✅ ${slug} créé (#${doc.id})`);
            created++;
        }
    }

    console.log(`\n📊 Récapitulatif : ${created} créés, ${updated} mis à jour (${DRY_RUN ? 'dry-run' : 'exécution réelle'})`);
    db.close();
}

main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
});
