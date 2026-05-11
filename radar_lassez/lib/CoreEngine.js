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

    updateScannerStatus(status, message) {
        try {
            this.db.prepare(`INSERT OR REPLACE INTO radar_settings (key, value) VALUES ('scanner_status', ?)`).run(status);
            this.db.prepare(`INSERT OR REPLACE INTO radar_settings (key, value) VALUES ('scanner_message', ?)`).run(message);
        } catch (e) {
            console.error('⚠️ [CoreEngine] Failed to update scanner status:', e.message);
        }
    }

    async runFullScan() {
        console.log('🚀 [CoreEngine] Starting full scan...');
        this.updateScannerStatus('starting', 'Démarrage du scan...');
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

        this.pipeline = new JournalisticPipeline(this.apiKey, settings, graph, this.db);

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
        this.updateScannerStatus('ingesting', `Ingestion en cours (${sources.rss.length} RSS, ${sources.telegram.length} TG...)`);
        console.log(`🌐 [CoreEngine] Starting ingestion for ${sources.rss.length} RSS, ${sources.telegram.length} TG, ${sources.x.length} X, ${sources.google_news.length} GN...`);
        
        // Helper to check if source is disabled
        const isSourceDisabled = (url) => {
            const health = this.db.prepare('SELECT status FROM radar_source_health WHERE url = ?').get(url);
            return health?.status === 'DISABLED';
        };

        for (const url of sources.rss) {
            if (isSourceDisabled(url)) {
                console.log(`⏭️ [RSS] Skipping disabled source: ${url}`);
                continue;
            }
            console.log(`📡 [RSS] Fetching: ${url}`);
            try {
                const items = await this.rssProvider.fetch(url, parseInt(settings.rss_lookback_hours || '24'));
                console.log(`   -> Found ${items.length} items`);
                allArticles.push(...items);
                this.reportSourceHealth(url, 'rss', true);
            } catch (error) {
                console.error(`[RSS] Failed ${url}:`, error.message);
                this.reportSourceHealth(url, 'rss', false, error.message);
            }
        }
        for (const handle of sources.telegram) {
            const url = `tg://${handle}`;
            if (isSourceDisabled(url)) continue;
            console.log(`📡 [Telegram] Fetching: @${handle}`);
            try {
                const items = await this.tgProvider.fetch(handle);
                console.log(`   -> Found ${items.length} items`);
                allArticles.push(...items);
                this.reportSourceHealth(url, 'telegram', true);
            } catch (error) {
                this.reportSourceHealth(url, 'telegram', false, error.message);
            }
        }
        for (const user of sources.x) {
            const url = `x://${user}`;
            if (isSourceDisabled(url)) continue;
            console.log(`📡 [X] Fetching: @${user}`);
            try {
                const items = await this.xProvider.fetchAccount(user);
                console.log(`   -> Found ${items.length} items`);
                allArticles.push(...items);
                this.reportSourceHealth(url, 'x', true);
            } catch (error) {
                this.reportSourceHealth(url, 'x', false, error.message);
            }
        }
        for (const query of sources.google_news) {
            const url = `gn://${query}`;
            if (isSourceDisabled(url)) continue;
            console.log(`📡 [GoogleNews] Fetching: "${query}"`);
            try {
                const items = await this.googleNewsProvider.fetch(query, parseInt(settings.rss_lookback_hours || '24'));
                console.log(`   -> Found ${items.length} items`);
                allArticles.push(...items);
                this.reportSourceHealth(url, 'google_news', true);
            } catch (error) {
                this.reportSourceHealth(url, 'google_news', false, error.message);
            }
        }

        console.log(`📥 [CoreEngine] Total ingested: ${allArticles.length} articles.`);

        // 2. Filtering & Deduplication
        const newArticles = allArticles.filter(a => !this.isProcessed(a.id || a.url));
        console.log(`✨ [CoreEngine] ${newArticles.length} new articles to process.`);

        if (newArticles.length === 0) {
            this.updateScannerStatus('idle', `Scan terminé. 0 nouvel article.`);
            return;
        }

        // 3. Fast Triage by Batches (Agent 1)
        this.updateScannerStatus('researching', `Filtrage de masse de ${newArticles.length} articles...`);
        let pertinentArticles = [];
        
        // Chunk articles by 40
        for (let i = 0; i < newArticles.length; i += 40) {
            const batch = newArticles.slice(i, i + 40);
            console.log(`📝 [CoreEngine] Triage Batch ${i/40 + 1} (${batch.length} articles)...`);
            const acceptedIds = await this.pipeline.runResearcherBatch(batch);
            
            if (Array.isArray(acceptedIds)) {
                const acceptedStrings = acceptedIds.map(id => String(id));
                const retained = batch.filter(a => acceptedStrings.includes(String(a.id || '')));
                pertinentArticles.push(...retained);
            }
        }

        if (pertinentArticles.length === 0) {
            console.log(`🏁 [CoreEngine] Scan complete. Aucun article n'a passé le tamis.`);
            this.updateScannerStatus('idle', `Scan terminé. Rien de pertinent.`);
            return;
        }

        console.log(`✨ [CoreEngine] ${pertinentArticles.length} articles retenus pour édition.`);

        // 4. Édition (Agent 2) - Parallel Processing
        const maxArticles = parseInt(settings.max_articles || '5');
        const concurrency = parseInt(settings.max_concurrent_tasks || '3');
        const toProcess = pertinentArticles.slice(0, maxArticles);
        
        console.log(`🚀 [CoreEngine] Starting parallel processing of ${toProcess.length} articles (concurrency: ${concurrency})...`);
        
        let processedCount = 0;
        const chunks = [];
        for (let i = 0; i < toProcess.length; i += concurrency) {
            chunks.push(toProcess.slice(i, i + concurrency));
        }

        for (const [chunkIdx, chunk] of chunks.entries()) {
            console.log(`📦 [CoreEngine] Processing Batch ${chunkIdx + 1}/${chunks.length}...`);
            const batchPromises = chunk.map(async (article, idx) => {
                const currentIdx = chunkIdx * concurrency + idx + 1;
                this.updateScannerStatus('editing', `Rédaction flash ${currentIdx}/${toProcess.length}...`);
                
                try {
                    const flash = await this.pipeline.processSingle(article, 'BREAKING');
                    if (flash) {
                        console.log(`   ✅ [CoreEngine] Flash generated: ${flash.shortTitle}`);
                        this.enqueuePost(article.id || article.url, article.sourceTitle || "Source", flash);
                        return true;
                    }
                } catch (e) {
                    console.error(`   ❌ [CoreEngine] Pipeline failed for article ${article.id}:`, e.message);
                }
                return false;
            });
            
            const batchResults = await Promise.all(batchPromises);
            processedCount += batchResults.filter(r => r).length;
            
            // Tempo entre les batches
            if (chunkIdx < chunks.length - 1) {
                console.log(`⏳ [CoreEngine] Waiting for API cooldown (2s)...`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        console.log(`🏁 [CoreEngine] Scan complete. ${processedCount} flashes enqueued.`);
        this.updateScannerStatus('idle', `Scan terminé. ${processedCount} alertes générées.`);
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

    reportSourceHealth(url, type, success, errorMsg = null) {
        try {
            const existing = this.db.prepare('SELECT consecutive_failures FROM radar_source_health WHERE url = ?').get(url);
            
            if (success) {
                this.db.prepare(`
                    INSERT OR REPLACE INTO radar_source_health (url, type, consecutive_failures, status, last_status, last_error, last_check_at)
                    VALUES (?, ?, 0, 'HEALTHY', 200, NULL, CURRENT_TIMESTAMP)
                `).run(url, type);
            } else {
                const newFailures = (existing?.consecutive_failures || 0) + 1;
                let newStatus = 'HEALTHY';
                if (newFailures >= 5) newStatus = 'DISABLED';
                else if (newFailures >= 3) newStatus = 'DEGRADED';

                this.db.prepare(`
                    INSERT OR REPLACE INTO radar_source_health (url, type, consecutive_failures, status, last_status, last_error, last_check_at)
                    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `).run(url, type, newFailures, newStatus, 500, errorMsg);
                
                if (newStatus !== 'HEALTHY') {
                    console.warn(`⚠️ [CoreEngine] Source ${url} is now ${newStatus} (${newFailures} failures)`);
                }
            }
        } catch (e) {
            console.error('⚠️ [CoreEngine] Failed to report source health:', e.message);
        }
    }
}
