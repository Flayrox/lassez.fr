#!/usr/bin/env node
/**
 * Migration one-shot : radar_posts legacy (PUBLISHED) → collection Payload "revelations" (brouillons).
 *
 * Usage :
 *   PAYLOAD_API_URL=http://127.0.0.1:5173/api/payload \
 *   PAYLOAD_BOT_EMAIL=... PAYLOAD_BOT_PASSWORD=... \
 *   node scripts/migrate_posts_to_revelations.cjs [--db=path] [--max=10] [--dry-run]
 *
 * Comportement :
 *   - Ne traite QUE les posts legacy au statut PUBLISHED (34 au total).
 *   - Ne prend que les --max plus récents (hors "[TEST]" par défaut).
 *   - Crée les tags manquants (collection tags) à la volée.
 *   - Crée chaque révélation en brouillon (_status: draft), même date de création.
 *   - Idempotent : saute les titres déjà présents dans revelations.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const { DatabaseSync } = require('node:sqlite');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const dbArg = args.find((a) => a.startsWith('--db='));
const maxArg = args.find((a) => a.startsWith('--max='));
const DB_PATH = dbArg ? dbArg.slice('--db='.length) : path.join(process.cwd(), 'data', 'radar.db');
const MAX = maxArg ? parseInt(maxArg.slice('--max='.length), 10) : 10;

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
        headers: {
            'Content-Type': 'application/json',
            Authorization: `JWT ${token}`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${method} ${pathname}: ${text.slice(0, 400)}`);
    }
    return res.json();
}

/** Construit le JSON richText lexical pour un texte brut. */
function toLexicalRichText(raw) {
    const blocks = String(raw || '').split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
    const children = blocks.length
        ? blocks.map((b) => ({
              type: 'paragraph',
              version: 1,
              children: [{ type: 'text', text: b }],
          }))
        : [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: '' }] }];
    return {
        root: { type: 'root', format: '', indent: 0, version: 1, children },
    };
}

function slugify(raw) {
    return String(raw || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

async function main() {
    console.log(`🔌 Lecture de la base SQLite : ${DB_PATH}`);
    if (!fs.existsSync(DB_PATH)) throw new Error(`Base introuvable : ${DB_PATH}`);
    const db = new DatabaseSync(DB_PATH, { readOnly: true });
    const posts = db.prepare(
        `SELECT id, source_url, source_title, flash_content, geo, tags, type_ouverture, fiabilite, created_at
         FROM radar_posts WHERE status = 'PUBLISHED' ORDER BY created_at DESC`
    ).all();
    console.log(`ℹ️ ${posts.length} posts PUBLISHED trouvés`);

    const candidates = posts.filter((p) => !/\[test\]/i.test(p.source_title)).slice(0, MAX);
    console.log(`ℹ️ ${candidates.length} candidats retenus (hors [TEST], max ${MAX})`);

    if (!DRY_RUN) await login();

    // Récupère les revelations existantes (pour l'idempotence) et les tags existants.
    const existingRev = (await api('GET', '/revelations?limit=1000&depth=0')).docs;
    const existingTitles = new Set(existingRev.map((r) => String(r.titre || '').trim().toLowerCase()));
    const existingTags = (await api('GET', '/tags?limit=1000&depth=0')).docs;
    const tagBySlug = new Map(existingTags.map((t) => [String(t.slug || '').toLowerCase(), t.id]));

    let created = 0;
    let skipped = 0;
    const createdTags = [];

    for (const post of candidates) {
        const titre = String(post.source_title || '').trim();
        if (!titre) { skipped++; continue; }
        if (existingTitles.has(titre.toLowerCase())) { skipped++; continue; }

        // Tags : créer les manquants.
        const tagNames = String(post.tags || '').split(',').map((t) => t.trim()).filter(Boolean);
        const tagIds = [];
        for (const name of tagNames) {
            const slug = slugify(name);
            let id = tagBySlug.get(slug);
            if (!id && !DRY_RUN) {
                try {
                    const t = await api('POST', '/tags', { name, slug });
                    id = t.id;
                    createdTags.push(name);
                } catch (e) {
                    // Doublon (race ou casse) : on re-liste par slug.
                    const existing = await api('GET', `/tags?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`);
                    id = existing.docs?.[0]?.id;
                }
            }
            if (id) {
                tagIds.push(id);
                tagBySlug.set(slug, id);
            }
        }

        const payload = {
            titre,
            slug: slugify(titre) + '-' + post.id,
            contenu_rapide: toLexicalRichText(post.flash_content),
            niveau_alerte: 'Public',
            zone_geo: post.geo === 'international' ? 'international' : 'france',
            tags: tagIds,
            _status: 'draft',
        };

        if (DRY_RUN) {
            console.log(`  [dry-run] revelation « ${titre.slice(0, 60)} » (tags: ${tagNames.join(',') || '—'})`);
            created++;
            continue;
        }

        const doc = await api('POST', '/revelations', payload);
        console.log(`✅ revelation #${doc?.id ?? doc?._id ?? '?'} « ${titre.slice(0, 60)} » (tags: ${tagNames.join(',') || '—'})`);
        created++;
    }

    console.log(`\n📊 Récapitulatif : ${created} revelations (${DRY_RUN ? 'dry-run' : 'créées'}), ${skipped} sautées, ${createdTags.length} tags créés`);
    db.close();
}

main().catch((e) => {
    console.error('❌', e.message);
    process.exit(1);
});
