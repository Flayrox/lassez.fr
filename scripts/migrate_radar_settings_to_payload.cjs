#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Migration unidirectionnelle des réglages de communication du site
 * (mode maintenance + popup) de la table SQLite legacy `radar_settings`
 * vers le global Payload `settings` (groupe `communication`).
 *
 * Seuls les 7 champs encore consommés par le front sont migrés :
 *   maintenance_mode, maintenance_message,
 *   popup_enabled, popup_title, popup_text, popup_link_url, popup_link_label
 *
 * Le reste de `radar_settings` (config du daemon TS : rss_feeds, ai_prompt,
 * pipeline_graph_json, …) est remplacé par le global `radar-settings` et
 * n'est PAS migré ici.
 *
 * Prérequis : compte admin Payload (PAYLOAD_BOT_EMAIL / PAYLOAD_BOT_PASSWORD
 * ou PAYLOAD_ADMIN_EMAIL / PAYLOAD_ADMIN_PASSWORD) + PAYLOAD_API_URL
 * (ou PAYLOAD_SERVER_URL) dans l'environnement.
 *
 * Usage :
 *   PAYLOAD_API_URL=https://api.lassez.fr/api/payload \
 *   PAYLOAD_BOT_EMAIL=bot@lassez.fr PAYLOAD_BOT_PASSWORD=*** \
 *   node scripts/migrate_radar_settings_to_payload.cjs [--dry-run] [--db=data/radar.db] [--overwrite]
 *
 * --overwrite : écrase aussi les valeurs Payload déjà renseignées
 * (par défaut, une valeur Payload existante est conservée).
 */
require('dotenv').config({ path: require('path').join(process.cwd(), '.env') });
const Database = require('better-sqlite3');
const path = require('path');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const OVERWRITE = args.includes('--overwrite');
const dbArg = args.find(a => a.startsWith('--db='));
const DB_PATH = dbArg ? dbArg.slice('--db='.length) : path.join(process.cwd(), 'data', 'radar.db');

const API_BASE = (process.env.PAYLOAD_API_URL || process.env.PAYLOAD_SERVER_URL || 'http://localhost:5173').replace(/\/+$/, '')
    .replace(/\/api\/payload$/, '') + '/api/payload';
const ADMIN_EMAIL = process.env.PAYLOAD_ADMIN_EMAIL || process.env.PAYLOAD_BOT_EMAIL || 'bot@lassez.fr';
const ADMIN_PASSWORD = process.env.PAYLOAD_ADMIN_PASSWORD || process.env.PAYLOAD_BOT_PASSWORD || '';

const SOURCE_KEYS = [
    'maintenance_mode',
    'maintenance_message',
    'popup_enabled',
    'popup_title',
    'popup_text',
    'popup_link_url',
    'popup_link_label',
];

/** Mapping SQLite → Payload `settings.communication`. */
const KEY_MAP = {
    maintenance_mode: { target: 'maintenanceMode', type: 'bool' },
    maintenance_message: { target: 'maintenanceMessage', type: 'string' },
    popup_enabled: { target: 'popupEnabled', type: 'bool' },
    popup_title: { target: 'popupTitle', type: 'string' },
    popup_text: { target: 'popupText', type: 'string' },
    popup_link_url: { target: 'popupLinkUrl', type: 'string' },
    popup_link_label: { target: 'popupLinkLabel', type: 'string' },
};

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

async function migrate() {
    console.log(`🔌 Lecture de la base SQLite : ${DB_PATH}`);
    if (!require('fs').existsSync(DB_PATH)) {
        console.error(`❌ Base introuvable : ${DB_PATH}`);
        process.exit(1);
    }

    const db = new Database(DB_PATH, { readonly: true });
    const rows = db.prepare(
        `SELECT key, value FROM radar_settings WHERE key IN (${SOURCE_KEYS.map(() => '?').join(',')})`
    ).all(...SOURCE_KEYS);
    db.close();

    const source = {};
    for (const row of rows) {
        source[row.key] = row.value;
    }

    const hasData = SOURCE_KEYS.some(k => {
        const value = source[k];
        if (value === undefined || value === null) return false;
        if (KEY_MAP[k].type === 'bool') return value === 'true' || value === 'false';
        return String(value).trim() !== '';
    });
    if (!hasData) {
        console.log('ℹ️ Aucune valeur à migrer (table radar_settings vide ou par défaut).');
        return;
    }

    // Valeurs cibles (booléens convertis, chaînes conservées telles quelles).
    const wanted = {};
    for (const k of SOURCE_KEYS) {
        const { target, type } = KEY_MAP[k];
        const raw = source[k];
        if (raw === undefined || raw === null) continue;
        wanted[target] = type === 'bool' ? raw === 'true' : String(raw);
    }

    // Fusion avec le global Payload existant (conservation par défaut).
    const current = await api('GET', '/globals/settings');
    const currentComm = (current && current.communication) || {};

    const merged = { ...currentComm };
    let changes = [];
    for (const [target, value] of Object.entries(wanted)) {
        const existing = merged[target];
        const isEmpty = existing === undefined || existing === null || existing === '';
        if (OVERWRITE || isEmpty) {
            if (existing !== value) {
                merged[target] = value;
                changes.push(`${target}: ${JSON.stringify(existing)} → ${JSON.stringify(value)}`);
            }
        } else {
            changes.push(`${target}: conservé (déjà renseigné : ${JSON.stringify(existing)})`);
        }
    }

    if (changes.length === 0) {
        console.log('ℹ️ Rien à écrire : les valeurs Payload sont déjà à jour.');
        return;
    }

    console.log('\n📝 Changements prévus :');
    for (const c of changes) console.log(`  • ${c}`);

    if (DRY_RUN) {
        console.log('\n(dry-run — rien n\'a été écrit)');
        return;
    }

    const updated = await api('POST', '/globals/settings', { communication: merged });
    console.log('\n✅ Global `settings.communication` mis à jour dans Payload.');

    if (updated && updated.communication) {
        console.log('   Valeurs finales :', JSON.stringify(updated.communication));
    }
}

migrate().catch((e) => {
    console.error('💥 Erreur fatale :', e.message);
    process.exit(1);
});
