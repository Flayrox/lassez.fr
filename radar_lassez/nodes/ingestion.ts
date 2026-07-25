import Parser from 'rss-parser';
import pLimit from 'p-limit';
import { prisma } from '../lib/prisma';
import { getEffectiveParam } from '../lib/config-resolver';

// Initialisation du parser RSS avec un délai d'expiration de 10 secondes
const parser = new Parser({
    timeout: 10000,
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

/**
 * Nœud 1 : Ingestion Multi-Sources (RSS, Google News, Telegram)
 * 
 * Aspire les nouveaux articles issus des flux configurés dans la base de données (Source table)
 * et des requêtes dynamiques de GlobalSettings sur une fenêtre temporelle paramétrable.
 */
export async function runIngestionNode(timeWindowHoursOverride?: number): Promise<IngestedArticle[]> {
    const timeWindowHours = timeWindowHoursOverride ?? await getEffectiveParam('ingestion', 'rss_lookback_hours', 12);
    
    console.log(`[Node 1: Ingestion] 🌐 Démarrage de l'aspiration (Fenêtre temporelle: ${timeWindowHours}h)`);
    
    const settings = await prisma.globalSettings.findFirst();
    const sourcesToProcess: any[] = [];

    // 1. Ingestion depuis la table Source (Sources permanentes granulairement paramétrées)
    const dbSources = await prisma.source.findMany({ where: { active: true } });
    dbSources.forEach(s => sourcesToProcess.push({
        url: s.url,
        type: s.type,
        source_name: s.source_name,
        source_bias: s.source_bias,
        trust_score: s.trust_score,
        allowSourceImages: s.allowSourceImages
    }));

    // 2. Ingestion des flux RSS depuis GlobalSettings
    if (settings?.rss_feeds) {
        try {
            const feeds = JSON.parse(settings.rss_feeds);
            if (Array.isArray(feeds)) {
                feeds.forEach(url => {
                    if (!sourcesToProcess.find(s => s.url === url)) {
                        sourcesToProcess.push({
                            url,
                            type: 'RSS',
                            source_name: new URL(url).hostname,
                            source_bias: 'Indépendant',
                            trust_score: 8,
                            allowSourceImages: true
                        });
                    }
                });
            }
        } catch (e: any) { console.error("[Node 1] ❌ Erreur lecture rss_feeds:", e.message); }
    }

    // 3. Ingestion des requêtes Google News
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
                        allowSourceImages: false
                    });
                });
            }
        } catch (e: any) { console.error("[Node 1] ❌ Erreur lecture google_news_queries:", e.message); }
    }

    if (sourcesToProcess.length === 0) {
        console.warn("[Node 1: Ingestion] ⚠️ Aucune source configurée.");
        return [];
    }

    const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - timeWindowMs);
    
    // Purge de l'historique des URL observées de plus de 7 jours
    try {
        const purgeDate = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000));
        await prisma.seenUrl.deleteMany({
            where: { createdAt: { lt: purgeDate } }
        });
    } catch (e: any) { }

    const seenUrls = new Set(
        (await prisma.seenUrl.findMany({ select: { url: true } })).map(s => s.url)
    );

    const limit = pLimit(5);
    const newArticles: IngestedArticle[] = [];
    const newSeenUrls: string[] = [];

    const tasks = sourcesToProcess.map(source => limit(async () => {
        try {
            const feed = await parser.parseURL(source.url);
            
            for (const item of feed.items) {
                if (!item.link || !item.title) continue;
                
                const itemDate = item.pubDate ? new Date(item.pubDate) : new Date();
                
                if (itemDate >= cutoffDate && !seenUrls.has(item.link)) {
                    seenUrls.add(item.link);
                    newSeenUrls.push(item.link);
                    
                    newArticles.push({
                        title: item.title.trim(),
                        url: item.link,
                        content: item.contentSnippet || item.content || item.title,
                        pubDate: itemDate,
                        source_name: source.source_name,
                        source_bias: source.source_bias,
                        trust_score: source.trust_score,
                        allowSourceImages: source.allowSourceImages
                    });
                }
            }
        } catch (error: any) {
            console.error(`[Node 1] ❌ Erreur lors de l'aspiration de ${source.source_name} (${source.url}):`, error.message);
        }
    }));

    await Promise.all(tasks);

    if (newSeenUrls.length > 0) {
        try {
            await prisma.seenUrl.createMany({
                data: newSeenUrls.map(url => ({ url })),
                skipDuplicates: true
            });
        } catch (e: any) { }
    }

    console.log(`[Node 1: Ingestion] ✅ Aspiration terminée : ${newArticles.length} nouveaux articles qualifiés.`);
    return newArticles;
}
