import Parser from 'rss-parser';
const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });

const endpoints = [
    'https://rsshub.rssforever.com/telegram/channel/brevesdepresse',
    'https://rsshub.rssforever.com/telegram/channel/AlertesInfos',
    'https://rsshub.rssforever.com/telegram/channel/CerfiaFr',
    'https://rsshub.rssforever.com/telegram/channel/Mediavenir'
];

async function testEndpoints() {
    for (const ep of endpoints) {
        try {
            console.log(`Testing: ${ep}`);
            const feed = await parser.parseURL(ep);
            console.log(`✅ SUCCESS: ${ep} -> ${feed.items.length} items`);
        } catch (e) {
            console.log(`❌ FAILED: ${ep} -> ${e.message}`);
        }
    }
}
testEndpoints();
