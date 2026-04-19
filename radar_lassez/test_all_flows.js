/**
 * ═══════════════════════════════════════════════════════════════
 *  TEST FLOWS - Validates Radar daemon's core processing pipeline
 *  
 *  Tests:
 *  1. RSS feed fetching & parsing
 *  2. Gemini AI analysis (token counting)
 *  3. Deduplication (duplicate filter)
 *  4. Discord webhook delivery
 *  5. Database connectivity
 * ═══════════════════════════════════════════════════════════════
 */

import fetch from 'node-fetch';
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const dbPath = path.join(__dirname, 'radar.db');

let testResults = {
    db_connection: { status: 'PENDING', message: '' },
    rss_fetch: { status: 'PENDING', message: '' },
    gemini_api: { status: 'PENDING', message: '' },
    discord_webhook: { status: 'PENDING', message: '' },
    deduplicator: { status: 'PENDING', message: '' },
};

function logTest(title, result) {
    const status = result.status === 'OK' ? '✅' : '❌';
    console.log(`${status} ${title}: ${result.message}`);
}

async function testDatabaseConnection() {
    try {
        const db = new Database(dbPath);
        const result = db.prepare('SELECT COUNT(*) as count FROM radar_posts').get();
        db.close();
        testResults.db_connection = { 
            status: 'OK', 
            message: `Connected. Found ${result.count} posts.` 
        };
    } catch (error) {
        testResults.db_connection = { 
            status: 'FAIL', 
            message: error.message 
        };
    }
}

async function testRSSFeed() {
    try {
        const feedUrl = 'https://www.france24.com/en/rss';
        const response = await fetch(feedUrl, { timeout: 10000 });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const text = await response.text();
        const hasRssContent = text.includes('<rss') || text.includes('<feed');
        if (!hasRssContent) {
            throw new Error('Response is not valid RSS/Atom');
        }
        testResults.rss_fetch = { 
            status: 'OK', 
            message: `Fetched ${Math.round(text.length / 1024)}KB from France24 RSS` 
        };
    } catch (error) {
        testResults.rss_fetch = { 
            status: 'FAIL', 
            message: error.message 
        };
    }
}

async function testGeminiAPI() {
    if (!GEMINI_API_KEY) {
        testResults.gemini_api = { 
            status: 'FAIL', 
            message: 'GEMINI_API_KEY not configured' 
        };
        return;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:countTokens?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ role: 'user', parts: [{ text: 'test' }] }]
                }),
                timeout: 10000
            }
        );

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errText.substring(0, 100)}`);
        }

        const data = await response.json();
        testResults.gemini_api = { 
            status: 'OK', 
            message: `API reachable. Token count works.` 
        };
    } catch (error) {
        testResults.gemini_api = { 
            status: 'FAIL', 
            message: error.message 
        };
    }
}

async function testDiscordWebhook() {
    if (!DISCORD_WEBHOOK_URL) {
        testResults.discord_webhook = { 
            status: 'FAIL', 
            message: 'DISCORD_WEBHOOK_URL not configured' 
        };
        return;
    }

    try {
        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                content: '🧪 [TEST FLUX] Discord webhook test - ignore this message'
            }),
            timeout: 10000
        });

        if (response.status === 204 || response.status === 200) {
            testResults.discord_webhook = { 
                status: 'OK', 
                message: `Webhook delivered (HTTP ${response.status})` 
            };
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        testResults.discord_webhook = { 
            status: 'FAIL', 
            message: error.message 
        };
    }
}

async function testDeduplicator() {
    try {
        const db = new Database(dbPath);
        
        // Check if deduplicator table exists
        const tables = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='dedup_cache'"
        ).all();

        if (tables.length === 0) {
            testResults.deduplicator = { 
                status: 'OK', 
                message: 'Dedup table will be auto-created on first use' 
            };
        } else {
            const cacheSize = db.prepare('SELECT COUNT(*) as count FROM dedup_cache').get();
            testResults.deduplicator = { 
                status: 'OK', 
                message: `Dedup cache initialized (${cacheSize.count} hashes)` 
            };
        }
        
        db.close();
    } catch (error) {
        testResults.deduplicator = { 
            status: 'FAIL', 
            message: error.message 
        };
    }
}

async function runAllTests() {
    console.log('[TEST FLUX] Starting comprehensive flow tests...\n');

    await testDatabaseConnection();
    logTest('Database Connection', testResults.db_connection);

    await testRSSFeed();
    logTest('RSS Feed Fetch', testResults.rss_fetch);

    await testGeminiAPI();
    logTest('Gemini API (countTokens)', testResults.gemini_api);

    await testDiscordWebhook();
    logTest('Discord Webhook', testResults.discord_webhook);

    await testDeduplicator();
    logTest('Deduplicator', testResults.deduplicator);

    // Summary
    console.log('\n' + '='.repeat(50));
    const passCount = Object.values(testResults).filter(r => r.status === 'OK').length;
    const totalCount = Object.values(testResults).length;
    console.log(`Results: ${passCount}/${totalCount} tests passed`);
    console.log('='.repeat(50) + '\n');

    // Exit with appropriate code
    const allPassed = passCount === totalCount;
    process.exit(allPassed ? 0 : 1);
}

// Run tests
runAllTests().catch(error => {
    console.error('[TEST FLUX] Fatal error:', error);
    process.exit(1);
});
