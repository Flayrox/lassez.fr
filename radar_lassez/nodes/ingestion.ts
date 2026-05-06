import Parser from 'rss-parser';
import { prisma } from '../lib/prisma';

const parser = new Parser();

export interface IngestedArticle {
    title: string;
    url: string;
    content: string;
    pubDate: Date;
    source_name: string;
    source_bias: string;
    trust_score: number;
}

export async function runIngestionNode(timeWindowHours: number = 12): Promise<IngestedArticle[]> {
    console.log(`[Node 1: Ingestion] 🌐 Démarrage de l'aspiration (Fenêtre temporelle: ${timeWindowHours}h)`);
    
    // 1. Récupération des sources depuis la BDD (UI-Driven)
    const sources = await prisma.source.findMany();
    if (sources.length === 0) {
        console.warn("[Node 1: Ingestion] ⚠️ Aucune source configurée dans la table Source.");
        return [];
    }

    const timeWindowMs = timeWindowHours * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - timeWindowMs);
    
    let allArticles: IngestedArticle[] = [];

    // 2. Exécution concurrente de l'aspiration des flux
    // Utilisation de Promise.all pour ne pas bloquer l'Event Loop (asynchronisme natif)
    await Promise.all(sources.map(async (source) => {
        try {
            if (source.type === 'RSS' || source.type === 'GOOGLE_NEWS') {
                const feed = await parser.parseURL(source.url);
                
                // Filtrage temporel basé sur la date de publication
                const validItems = feed.items.filter(item => {
                    const dateStr = item.isoDate || item.pubDate;
                    if (!dateStr) return false;
                    
                    const date = new Date(dateStr);
                    return date >= cutoffDate;
                });

                const formatted: IngestedArticle[] = validItems.map(item => ({
                    title: item.title || 'Sans titre',
                    url: item.link || '',
                    // Fallback sur différentes clés de contenu selon les structures RSS
                    content: item.contentSnippet || item.content || item.summary || '',
                    pubDate: new Date(item.isoDate || item.pubDate || ''),
                    // Enrichissement obligatoire des métadonnées (La ligne éditoriale démarre ici)
                    source_name: source.source_name,
                    source_bias: source.source_bias,
                    trust_score: source.trust_score
                }));

                allArticles.push(...formatted);
                console.log(`[Node 1] ✅ [${source.source_name}] : ${formatted.length} articles retenus hors de ${feed.items.length}.`);
            } 
            else if (source.type === 'TELEGRAM') {
                // Mock asynchrone de l'API Telegram pour le moment
                console.log(`[Node 1] 🚧 [${source.source_name}] Mock: Aspiration API Telegram simulée.`);
            }
        } catch (error) {
            console.error(`[Node 1] ❌ Erreur de scrap sur la source ${source.source_name} (${source.url}):`, error instanceof Error ? error.message : error);
        }
    }));

    console.log(`[Node 1: Ingestion] 🏁 Fin de l'aspiration. Total brut : ${allArticles.length} articles.`);
    return allArticles;
}