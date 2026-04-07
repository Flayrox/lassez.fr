/**
 * ═══════════════════════════════════════════════════════════════
 *  RADAR L'ASSEZ — MODULE TAMIS ANTI-DOUBLONS
 *  
 *  Économise le budget API Gemini en :
 *  1. Regroupant les articles similaires (clustering par titre)
 *  2. Fusionnant le contenu des clusters
 *  3. Vérifiant qu'un sujet n'a pas déjà été traité (check 24h)
 * ═══════════════════════════════════════════════════════════════
 */

import { compareTwoStrings } from 'string-similarity';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SIMILARITY_THRESHOLD = 0.65; // Seuil de similarité pour fusionner
const DEFAULT_RECENT_HOURS = 24; // Fenêtre anti-doublon en heures

/**
 * Normalise un titre pour la comparaison
 */
function normalizeTitle(title) {
    return (title || '')
        .toLowerCase()
        .replace(/[^\w\sàâäéèêëïîôùûüÿçœæ]/g, '') // Garder lettres FR + espaces
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Regroupe les articles par similarité de titre.
 * Retourne des "clusters" : chaque cluster contient les articles fusionnés.
 */
function clusterBySimilarity(items, similarityThreshold = DEFAULT_SIMILARITY_THRESHOLD) {
    const clusters = []; // Chaque cluster = { representative: item, members: [item, ...] }
    const assigned = new Set();

    for (let i = 0; i < items.length; i++) {
        if (assigned.has(i)) continue;

        const cluster = { representative: items[i], members: [items[i]] };
        assigned.add(i);

        for (let j = i + 1; j < items.length; j++) {
            if (assigned.has(j)) continue;

            const titleA = normalizeTitle(items[i].title);
            const titleB = normalizeTitle(items[j].title);

            if (titleA.length < 5 || titleB.length < 5) continue; // Titres trop courts = skip

            const similarity = compareTwoStrings(titleA, titleB);

            if (similarity >= similarityThreshold) {
                cluster.members.push(items[j]);
                assigned.add(j);

                // Le représentant est toujours celui avec le titre le plus long (plus d'info)
                if (items[j].title.length > cluster.representative.title.length) {
                    cluster.representative = items[j];
                }
            }
        }

        clusters.push(cluster);
    }

    return clusters;
}

/**
 * Fusionne les membres d'un cluster en un seul item enrichi.
 */
function mergeCluster(cluster) {
    const rep = cluster.representative;

    if (cluster.members.length === 1) return rep;

    // Fusionner les contenus (dédupliqués par source)
    const allContent = cluster.members
        .map(m => `[Source: ${m.sourceTitle}] ${m.content}`)
        .join('\n\n---\n\n');

    // Collecter toutes les URLs d'images disponibles
    const imageUrl = cluster.members.find(m => m.imageUrl)?.imageUrl || null;

    return {
        ...rep,
        content: allContent.substring(0, 4000), // Limiter pour ne pas surcharger le prompt
        imageUrl: imageUrl || rep.imageUrl,
        _clusterSize: cluster.members.length,
        _clusterSources: cluster.members.map(m => m.sourceTitle).join(', ')
    };
}

/**
 * Vérifie si un sujet similaire a déjà été traité récemment (24h).
 * Interroge radar_posts pour les titres récents.
 */
function wasRecentlyPublished(title, db, recentHours = DEFAULT_RECENT_HOURS) {
    try {
        const normalizedTitle = normalizeTitle(title);
        if (normalizedTitle.length < 10) return false; // Titre trop court pour comparer

        const recentPosts = db.prepare(`
            SELECT source_title FROM radar_posts 
            WHERE created_at > datetime('now', '-${recentHours} hours')
            AND status != 'IGNORED'
        `).all();

        for (const post of recentPosts) {
            const similarity = compareTwoStrings(
                normalizedTitle,
                normalizeTitle(post.source_title)
            );
            if (similarity >= 0.7) { // Seuil plus strict pour le check 24h
                return true;
            }
        }

        return false;
    } catch (e) {
        console.warn('⚠️ Erreur check 24h:', e.message);
        return false;
    }
}

/**
 * Pipeline complet de déduplication.
 * 
 * @param {Array} items - Articles bruts (unreadItems)
 * @param {Database} db - Instance better-sqlite3
 * @returns {Array} - Articles dédupliqués et fusionnés
 */
export function deduplicateItems(items, db, options = {}) {
    if (!items || items.length === 0) return [];
    const similarityThreshold = Math.max(0.3, Math.min(0.95, Number(options.similarityThreshold || DEFAULT_SIMILARITY_THRESHOLD)));
    const recentHours = Math.max(1, Math.min(168, Number(options.recentHours || DEFAULT_RECENT_HOURS)));

    const originalCount = items.length;

    // Étape 1 : Clustering par similarité de titre
    const clusters = clusterBySimilarity(items, similarityThreshold);
    const clusteredCount = clusters.length;

    // Étape 2 : Fusion des clusters
    const merged = clusters.map(c => mergeCluster(c));

    // Étape 3 : Check 24h — retirer les sujets déjà traités
    const deduplicated = merged.filter(item => {
        const alreadyDone = wasRecentlyPublished(item.title, db, recentHours);
        if (alreadyDone) {
            console.log(`  🛡️ [TAMIS] Sujet déjà traité (24h) : "${item.title.substring(0, 60)}..."`);
        }
        return !alreadyDone;
    });

    // Stats
    const fusionCount = originalCount - clusteredCount;
    const recentSkipCount = merged.length - deduplicated.length;

    console.log(`🛡️ [TAMIS] Résultat :`);
    console.log(`   📥 ${originalCount} articles entrants`);
    if (fusionCount > 0) console.log(`   🔗 ${fusionCount} fusionnés (${clusteredCount} clusters)`);
    if (recentSkipCount > 0) console.log(`   ⏭️  ${recentSkipCount} ignorés (déjà traités < 24h)`);
    console.log(`   📤 ${deduplicated.length} articles envoyés à l'IA`);

    return deduplicated;
}
