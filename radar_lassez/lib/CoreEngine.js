import { RSSProvider } from './providers/RSSProvider.js';
import { TelegramProvider } from './providers/TelegramProvider.js';
import { XProvider } from './providers/XProvider.js';
import { GoogleNewsProvider } from './providers/GoogleNewsProvider.js';
import { JournalisticPipeline } from './pipeline/Pipeline.js';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class CoreEngine {
    constructor(dbPath, apiKey) {
        this.db = new Database(dbPath);
        this.apiKey = apiKey;
        this.rssProvider = new RSSProvider();
        this.tgProvider = new TelegramProvider();
        this.xProvider = new XProvider('http://localhost:3300');
        this.googleNewsProvider = new GoogleNewsProvider();
    }

    async runFullScan() {
        console.log('🚀 [CoreEngine] Starting full scan...');
        const settings = this.getSettings();
        
        // Parse graph if exists
        let graph = null;
        try {
            if (settings.pipeline_graph_json) {
                graph = JSON.parse(settings.pipeline_graph_json);
                console.log(`📊 [CoreEngine] Pipeline graph loaded with ${graph.nodes?.length || 0} nodes.`);
            }
        } catch (e) {
            console.warn('⚠️ [CoreEngine] Failed to parse pipeline graph:', e.message);
        }

        this.pipeline = new JournalisticPipeline(this.apiKey, settings, graph);

        if (settings.rss_bridge_base_url) {
            this.xProvider = new XProvider(settings.rss_bridge_base_url);
        }

        const sources = {
            rss: JSON.parse(settings.rss_feeds || '[]'),
            telegram: JSON.parse(settings.telegram_channels || '[]'),
            x: JSON.parse(settings.x_accounts || '[]'),
            google_news: JSON.parse(settings.google_news_queries || '[]')
        };

        // Filter sources based on graph if available
        if (graph && graph.nodes) {
            const activeTypes = new Set(graph.nodes.map((n) => n.type));
            if (!activeTypes.has('rss')) sources.rss = [];
            if (!activeTypes.has('telegram')) sources.telegram = [];
            if (!activeTypes.has('x')) sources.x = [];
            if (!activeTypes.has('google-news')) sources.google_news = [];
            console.log(`🎯 [CoreEngine] Active source types: ${Array.from(activeTypes).join(', ')}`);
        }

        const allArticles = [];

        // 1. Ingestion
        console.log(`🌐 [CoreEngine] Starting ingestion for ${sources.rss.length} RSS, ${sources.telegram.length} TG, ${sources.x.length} X, ${sources.google_news.length} GN...`);
        for (const url of sources.rss) {
            console.log(`📡 [RSS] Fetching: ${url}`);
            const items = await this.rssProvider.fetch(url, parseInt(settings.rss_lookback_hours || '24'));
            console.log(`   -> Found ${items.length} items`);
            allArticles.push(...items);
        }
        for (const handle of sources.telegram) {
            console.log(`📡 [Telegram] Fetching: @${handle}`);
            const items = await this.tgProvider.fetch(handle);
            console.log(`   -> Found ${items.length} items`);
            allArticles.push(...items);
        }
        for (const user of sources.x) {
            console.log(`📡 [X] Fetching: @${user}`);
            const items = await this.xProvider.fetchAccount(user);
            console.log(`   -> Found ${items.length} items`);
            allArticles.push(...items);
        }
        for (const query of sources.google_news) {
            console.log(`📡 [GoogleNews] Fetching: "${query}"`);
            const items = await this.googleNewsProvider.fetch(query, parseInt(settings.rss_lookback_hours || '24'));
            console.log(`   -> Found ${items.length} items`);
            allArticles.push(...items);
        }

        console.log(`📥 [CoreEngine] Total ingested: ${allArticles.length} articles.`);

        // 2. Filtering & Deduplication
        const newArticles = allArticles.filter(a => !this.isProcessed(a.id));
        console.log(`✨ [CoreEngine] ${newArticles.length} new articles to process.`);

        // 3. Journalistic Processing
        let processedCount = 0;
        const maxArticles = parseInt(settings.max_articles || '3');
        console.log(`⚙️ [CoreEngine] Processing articles (Max=${maxArticles})...`);

        for (const article of newArticles) {
            if (processedCount >= maxArticles) {
                console.log(`⏹️ [CoreEngine] Reached max_articles (${maxArticles}). Stopping.`);
                break;
            }
            console.log(`📝 [CoreEngine] Processing article: ${article.title.substring(0, 50)}...`);
            const flash = await this.pipeline.processArticle(article, 'BREAKING');
            if (flash) {
                console.log(`✅ [CoreEngine] Flash generated successfully: ${flash.shortTitle}`);
                this.enqueuePost(article.id, article.sourceTitle, flash);
                processedCount++;
            } else {
                console.warn(`❌ [CoreEngine] Pipeline failed for: ${article.title}`);
            }
        }
        console.log(`🏁 [CoreEngine] Scan complete. ${processedCount} flashes enqueued.`);
    }

    getSettings() {
        const rows = this.db.prepare('SELECT key, value FROM radar_settings').all();
        const settings = {};
        for (const r of rows) settings[r.key] = r.value;
        return settings;
    }

    isProcessed(sourceUrl) {
        const row = this.db.prepare('SELECT id FROM radar_posts WHERE source_url = ?').get(sourceUrl);
        return !!row;
    }

    enqueuePost(sourceUrl, sourceTitle, flash) {
        console.log(`💾 [CoreEngine] Enqueueing to DB: ${flash.shortTitle}`);
        try {
            this.db.prepare(`
                INSERT OR IGNORE INTO radar_posts 
                (source_url, source_title, flash_content, image_keyword, status, geo, tags, punchline, type_ouverture, fiabilite) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                sourceUrl, sourceTitle, flash.flash, flash.imageKeyword, 'PENDING', 
                flash.geo || 'france', (flash.tags || []).join(', '), flash.punchline, 
                flash.typeOuverture, flash.fiabilite
            );
            console.log(`   -> OK! Saved.`);
        } catch (e) {
            console.error('⚠️ [CoreEngine] Error during enqueue:', e.message);
        }
    }
}
