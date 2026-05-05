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
        this.pipeline = new JournalisticPipeline(this.apiKey, settings);

        if (settings.rss_bridge_base_url) {
            this.xProvider = new XProvider(settings.rss_bridge_base_url);
        }

        const sources = {
            rss: JSON.parse(settings.rss_feeds || '[]'),
            telegram: JSON.parse(settings.telegram_channels || '[]'),
            x: JSON.parse(settings.x_accounts || '[]'),
            google_news: JSON.parse(settings.google_news_queries || '[]')
        };

        const allArticles = [];

        // 1. Ingestion
        for (const url of sources.rss) {
            allArticles.push(...(await this.rssProvider.fetch(url, parseInt(settings.rss_lookback_hours || '24'))));
        }
        for (const handle of sources.telegram) {
            allArticles.push(...(await this.tgProvider.fetch(handle)));
        }
        for (const user of sources.x) {
            allArticles.push(...(await this.xProvider.fetchAccount(user)));
        }
        for (const query of sources.google_news) {
            allArticles.push(...(await this.googleNewsProvider.fetch(query, parseInt(settings.rss_lookback_hours || '24'))));
        }

        console.log(`📥 [CoreEngine] Ingested ${allArticles.length} articles.`);

        // 2. Filtering & Deduplication
        const newArticles = allArticles.filter(a => !this.isProcessed(a.id));
        console.log(`✨ [CoreEngine] ${newArticles.length} new articles to process.`);

        // 3. Journalistic Processing
        let processedCount = 0;
        const maxArticles = parseInt(settings.max_articles || '3');

        for (const article of newArticles) {
            if (processedCount >= maxArticles) break;
            const flash = await this.pipeline.processArticle(article, 'BREAKING');
            if (flash) {
                this.enqueuePost(article.id, article.sourceTitle, flash);
                processedCount++;
            }
        }
        console.log(`✅ [CoreEngine] Scan complete. ${processedCount} flashes enqueued.`);
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
        } catch (e) {
            console.error('⚠️ [CoreEngine] Error:', e.message);
        }
    }
}
