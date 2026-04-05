/**
 * MIGRATION : Tag geo + tags AI sur tous les posts existants sans tags.
 * Envoie les posts par batch de 15 à Gemini pour classification.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env'), override: true });

const db = new Database(path.join(__dirname, 'radar.db'));
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Récupère les posts sans tags
const postsToTag = db.prepare(`
    SELECT id, source_title, flash_content
    FROM radar_posts
    WHERE tags IS NULL OR tags = ''
    ORDER BY id ASC
`).all();

console.log(`📋 ${postsToTag.length} articles à tagger.`);

const BATCH_SIZE = 15;
const DELAY_MS = 4000; // Pause entre chaque batch pour éviter le rate-limit Gemini

async function tagBatch(batch) {
    const model = genAI.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        generationConfig: { responseMimeType: 'application/json' }
    });

    const articlesText = batch.map((post, i) => `
[POST_${i}]
Titre: ${post.source_title}
Contenu: ${post.flash_content.substring(0, 600)}
---`).join('\n');

    const prompt = `
Tu es un classificateur d'articles de presse. Pour chaque article, détermine :
1. "geo" : "france" si le sujet concerne principalement la France, "international" sinon.
2. "tags" : un tableau de 2 à 4 mots-clés thématiques en minuscules (ex: ["police", "grève", "macron"]).

Réponds UNIQUEMENT par un JSON Array avec exactement un objet par article dans l'ordre :
[{ "id": "POST_0", "geo": "france", "tags": ["tag1", "tag2"] }, ...]

Articles à classifier :
${articlesText}
`;

    try {
        const result = await model.generateContent(prompt);
        const rawText = result.response.text().replace(/```json/i, '').replace(/```/g, '').trim();
        return JSON.parse(rawText);
    } catch (e) {
        console.error('❌ Erreur Gemini ou parse:', e.message);
        return [];
    }
}

const updateStmt = db.prepare('UPDATE radar_posts SET geo = ?, tags = ? WHERE id = ?');
let totalTagged = 0;

for (let i = 0; i < postsToTag.length; i += BATCH_SIZE) {
    const batch = postsToTag.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(postsToTag.length / BATCH_SIZE);

    console.log(`\n🔄 Batch ${batchNum}/${totalBatches} (${batch.length} articles)...`);

    const results = await tagBatch(batch);

    if (!results || results.length === 0) {
        console.log('   ⚠️  Batch vide ou échec, on continue...');
        continue;
    }

    const txUpdate = db.transaction((batchResults) => {
        for (const res of batchResults) {
            const indexMatch = res.id.match(/\d+/);
            if (!indexMatch) continue;
            const index = parseInt(indexMatch[0], 10);
            const original = batch[index];
            if (!original) continue;

            const geo = res.geo || 'france';
            const tags = Array.isArray(res.tags) ? res.tags.join(',') : '';
            updateStmt.run(geo, tags, original.id);
            totalTagged++;
        }
    });

    txUpdate(results);
    console.log(`   ✅ ${results.length} articles taggés (total: ${totalTagged}/${postsToTag.length})`);

    // Pause entre les batches pour éviter le rate-limit Gemini
    if (i + BATCH_SIZE < postsToTag.length) {
        process.stdout.write(`   ⏳ Pause ${DELAY_MS / 1000}s...`);
        await new Promise(r => setTimeout(r, DELAY_MS));
        process.stdout.write(' OK\n');
    }
}

db.close();
console.log(`\n🎉 Migration terminée ! ${totalTagged}/${postsToTag.length} articles mis à jour.`);
