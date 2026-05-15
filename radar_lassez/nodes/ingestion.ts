import Parser from 'rss-parser';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

// Initialize parser with a timeout
const parser = new Parser({
    timeout: 10000, // 10 seconds timeout to prevent freezing
});

export interface IngestedArticle {
    title: string;
    url: string;
    content: string;
    pubDate: Date;
    source_name: string;
    source_bias: string;
    trust_score: number;
    allowSourceImages: boolean;
}

export async function runIngestionNode(timeWindowHoursOverride?: number): Promise<IngestedArticle[]> {
    // Résolution de la fenêtre temporelle : Override > Node > Global > Default (12)
    const timeWindowHours = timeWindowHoursOverride ?? await getEffectiveParam('ingestion', 'rss_lookback_hours', 12);
    
    console.log(`[Node 1: Ingestion] 🌐 Démarrage de l'aspiration (Fenêtre temporelle: ${timeWindowHours}h)`);
    
    // 1. Récupération des paramètres globaux (Flow-Driven)
    const settings = await prisma.globalSettings.findFirst();
    
    // 2. Préparation des sources
    const sourcesToProcess: any[] = [];

    // Ajouter les sources depuis la table Source (Gestion granulaire)
    const dbSources = await prisma.source.findMany({ where: { active: true } });
    dbSources.forEach(s => sourcesToProcess.push({
        url: s.url,
        type: s.type,
        source_name: s.source_name,
        source_bias: s.source_bias,
        trust_score: s.trust_score,
        allowSourceImages: s.allowSourceImages
    }));

    // Ajouter les flux RSS depuis GlobalSettings (Flow Canvas)
    if (settings?.rss_feeds) {
        try {
            const feeds = JSON.parse(settings.rss_feeds);
            if (Array.isArray(feeds)) {
                feeds.forEach(url => {
                    // Éviter les doublons si déjà présent dans Source table
                    if (!sourcesToProcess.find(s => s.url === url)) {
                        sourcesToProcess.push({
                            url,
                            type: 'RSS',
                            source_name: new URL(url).hostname,
                            source_bias: 'Indépendant',
                            trust_score: 8,
                            allowSourceImages: true // Par défaut pour les nouveaux du Flow
                        });
                    }
                });
            }
        } catch (e) { console.error("[Node 1] ❌ Erreur parsing rss_feeds:", e); }
    }

    // Ajouter Google News depuis GlobalSettings
    if (settings?.google_news_queries) {
        try {
            const queries = JSON.parse(settings.google_news_queries);
            if (Array.isArray(queries)) {
                queries.forEach(query => {
                    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`;
                    sourcesToProcess.push({
                        url,
                        type: 'GOOGLE_NEWS',
                        source_name: `GNews: ${query}`,
                        source_bias: 'Multiple',
                        trust_score: 7,
                        allowSourceImages: false // On évite les images GNews souvent mal castées
                    });
                });
            }
        } catch (e) { console.error("[Node 1] ❌ Erreur parsing google_news_queries:", e); }
    }

    if (sourcesToProcess.length === 0) {
        console.warn("[Node 1: Ingestion] ⚠️ Aucune source configurée.");
        return [];
    }

    const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - timeWindowMs);
    
    // Purger les vieilles URL de plus de 7 jours pour garder la base légère
    try {
        const purgeDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        await prisma.seenUrl.deleteMany({
            where: { createdAt: { lt: purgeDate } }
        });
    } catch(e) {}

    // Pré-chargement de toutes les URLs connues pour éviter les N+1 requêtes (Cache Local)
    const allKnownUrlsDb = await prisma.seenUrl.findMany({ select: { url: true } });
    const globalUrlCache = new Set(allKnownUrlsDb.map(u => u.url));

    let allArticles: IngestedArticle[] = [];
    let duplicateUrlsCount = 0;

    // 3. Exécution concurrente de l'aspiration avec limitation
    const concurrencyLimit = await getEffectiveParam('ingestion', 'maxConcurrentTasks', 5);
    const limit = pLimit(Number(concurrencyLimit));

    await Promise.all(sourcesToProcess.map(source => limit(async () => {
        try {
            if (source.type === 'RSS' || source.type === 'GOOGLE_NEWS') {
                const feed = await parser.parseURL(source.url);
                const validItems = feed.items.filter(item => {
                    const dateStr = item.isoDate || item.pubDate;
                    if (!dateStr) return false;
                    const date = new Date(dateStr);
                    return date >= cutoffDate;
                });

                const newArticles: IngestedArticle[] = [];
                for (const item of validItems) {
                    const url = item.link || '';
                    if (!url) continue;

                    if (globalUrlCache.has(url)) {
                        duplicateUrlsCount++;
                        continue;
                    }

                    newArticles.push({
                        title: item.title || 'Sans titre',
                        url: url,
                        content: item.contentSnippet || item.content || item.summary || '',
                        pubDate: new Date(item.isoDate || item.pubDate || ''),
                        source_name: source.source_name,
                        source_bias: source.source_bias,
                        trust_score: source.trust_score,
                        allowSourceImages: source.allowSourceImages
                    });
                    
                    // Add to global cache to prevent duplicates across feeds
                    globalUrlCache.add(url);
                }

                if (newArticles.length > 0) {
                    const newUrlsToSave = newArticles.map(a => a.url);
                    try {
                        await prisma.seenUrl.createMany({
                            data: Array.from(new Set(newUrlsToSave)).map(u => ({ url: u })),
                            skipDuplicates: true
                        });
                    } catch(e) { /* ignore */ }
                }

                allArticles.push(...newArticles);
                console.log(`[Node 1] ✅ [${source.source_name}] : ${newArticles.length} nouveaux articles retenus.`);
            } 
            else if (source.type === 'TELEGRAM') {
                console.log(`[Node 1] 🚧 [${source.source_name}] Mock: Aspiration Telegram simulée.`);
            }
        } catch (error) {
            console.error(`[Node 1] ❌ Erreur scrap ${source.source_name} (${source.url}):`, error instanceof Error ? error.message : error);
        }
    })));

    console.log(`[Node 1: Ingestion] 🏁 Fin. Total : ${allArticles.length} articles inédits. (${duplicateUrlsCount} URLs déjà connues bloquées).`);
    return allArticles;
}
