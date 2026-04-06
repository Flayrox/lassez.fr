/**
 * ═══════════════════════════════════════════════════════════════
 *  RADAR L'ASSEZ — MÉMOIRE POLITIQUE (RAG local FTS5)
 *  
 *  "Le Casier Judiciaire Politique"
 *  Traque les contradictions politiques grâce à une mémoire
 *  à long terme dans SQLite FTS5.
 *
 *  - searchArchives(entities) : cherche des contradictions
 *  - archiveDeclarations(flashResults) : stocke les nouvelles
 * ═══════════════════════════════════════════════════════════════
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Recherche dans les archives FTS5 des déclarations passées
 * liées aux entités politiques détectées dans les articles en cours.
 * 
 * @param {string[]} entities - Noms des personnalités politiques
 * @param {Database} db - Instance better-sqlite3
 * @returns {string} - Bloc de contexte à injecter dans le prompt Gemini
 */
export function searchArchives(entities, db) {
    if (!entities || entities.length === 0) return '';

    try {
        // Vérifier que la table existe
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='radar_archives'
        `).get();
        
        if (!tableExists) return '';

        const results = [];

        for (const entity of entities) {
            if (!entity || entity.length < 3) continue;

            try {
                // FTS5 MATCH query — on échappe les caractères spéciaux
                const safeEntity = entity.replace(/['"]/g, '').trim();
                if (!safeEntity) continue;

                const rows = db.prepare(`
                    SELECT date_archive, entite, declaration_brute, source_url,
                           rank
                    FROM radar_archives 
                    WHERE radar_archives MATCH ?
                    ORDER BY rank
                    LIMIT 3
                `).all(`"${safeEntity}"`);

                for (const row of rows) {
                    results.push({
                        date: row.date_archive,
                        entity: row.entite,
                        declaration: row.declaration_brute,
                        source: row.source_url
                    });
                }
            } catch (e) {
                // Si la requête FTS5 échoue pour cette entité, on skip
                continue;
            }
        }

        if (results.length === 0) return '';

        // Construire le bloc de contexte pour le prompt
        const contextLines = results.map(r => 
            `📁 [${r.date}] ${r.entity} : "${r.declaration.substring(0, 300)}" (Source: ${r.source})`
        );

        console.log(`🗄️ [RAG] ${results.length} archive(s) trouvée(s) pour : ${entities.join(', ')}`);

        return contextLines.join('\n');
    } catch (e) {
        console.warn('⚠️ [RAG] Erreur recherche archives:', e.message);
        return '';
    }
}

/**
 * Extrait les entités politiques des titres d'articles (heuristique simple).
 * Utilisé pour la recherche pré-prompt.
 * 
 * @param {Array} items - Articles bruts
 * @returns {string[]} - Entités détectées
 */
export function extractEntitiesFromTitles(items) {
    // Liste de politiciens connus pour la détection rapide
    const KNOWN_ENTITIES = [
        'Macron', 'Mélenchon', 'Melenchon', 'Le Pen', 'Bardella', 'Darmanin',
        'Borne', 'Attal', 'Panot', 'Ruffin', 'Roussel', 'Jadot', 'Tondelier',
        'Ciotti', 'Retailleau', 'Dupond-Moretti', 'Bayrou', 'Hayer',
        'Glucksmann', 'Hidalgo', 'Cazeneuve', 'Valls', 'Hollande',
        'Rima Hassan', 'Obono', 'Quatennens', 'Bompard', 'Coquerel',
        'Braun-Pivet', 'Larcher', 'Faure', 'Wauquiez', 'Pécresse',
        'Zemmour', 'Maréchal', 'Philippot', 'Asselineau',
        'Netanyahu', 'Biden', 'Trump', 'Poutine', 'Zelensky', 'Scholz',
        'Starmer', 'Von der Leyen', 'Erdogan', 'Xi Jinping',
        // Institutions
        'LFI', 'RN', 'NUPES', 'NFP', 'Renaissance', 'EELV', 'PS', 'PCF',
        'Assemblée nationale', 'Sénat', 'Conseil constitutionnel',
    ];

    const found = new Set();
    const allText = items.map(i => `${i.title} ${i.content || ''}`).join(' ');

    for (const entity of KNOWN_ENTITIES) {
        if (allText.includes(entity)) {
            found.add(entity);
        }
    }

    return [...found];
}

/**
 * Archive les déclarations politiques extraites par l'IA.
 * Appelée APRÈS la génération des flashs.
 * 
 * @param {Array} aiResults - Résultats JSON de Gemini
 * @param {Array} originalItems - Articles originaux (pour les source_url)
 * @param {Database} db - Instance better-sqlite3
 */
export function archiveDeclarations(aiResults, originalItems, db) {
    if (!aiResults || aiResults.length === 0) return;

    try {
        // Vérifier que la table existe
        const tableExists = db.prepare(`
            SELECT name FROM sqlite_master WHERE type='table' AND name='radar_archives'
        `).get();
        
        if (!tableExists) return;

        const insertStmt = db.prepare(`
            INSERT INTO radar_archives (date_archive, entite, mots_cles, declaration_brute, source_url)
            VALUES (?, ?, ?, ?, ?)
        `);

        let archived = 0;

        for (const result of aiResults) {
            const entities = result.entitesPolitiques || [];
            if (entities.length === 0) continue;

            // Retrouver la source originale
            const indexMatch = result.id?.match(/\d+/);
            const originalUrl = indexMatch && originalItems[parseInt(indexMatch[0], 10)]
                ? originalItems[parseInt(indexMatch[0], 10)].id
                : 'unknown';

            const tags = Array.isArray(result.tags) ? result.tags.join(', ') : '';
            const dateNow = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

            for (const entity of entities) {
                if (!entity || entity.length < 2) continue;

                try {
                    // On archive une version condensée du flash comme "déclaration"
                    const declaration = `${result.typeOuverture || ''} ${result.flash || ''}`.substring(0, 500);

                    insertStmt.run(
                        dateNow,
                        entity.trim(),
                        tags,
                        declaration,
                        originalUrl
                    );
                    archived++;
                } catch (e) {
                    // Ignore les erreurs individuelles d'insertion
                    continue;
                }
            }
        }

        if (archived > 0) {
            console.log(`🗄️ [RAG] ${archived} déclaration(s) archivée(s) dans le casier judiciaire.`);
        }
    } catch (e) {
        console.warn('⚠️ [RAG] Erreur archivage:', e.message);
    }
}
