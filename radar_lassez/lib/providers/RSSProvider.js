import Parser from 'rss-parser';

export class RSSProvider {
    constructor() {
        this.parser = new Parser({
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            customFields: {
                item: [
                    ['media:content', 'mediaContent'],
                    ['content:encoded', 'contentEncoded']
                ]
            }
        });
    }

    async fetch(url, lookbackHours = 24) {
        console.log(`[Provider:RSS] Fetching: ${url}`);
        try {
            const feed = await this.parser.parseURL(url);
            const now = new Date();
            
            return feed.items
                .filter(item => {
                    if (!item.isoDate && !item.pubDate) return true;
                    const date = new Date(item.isoDate || item.pubDate);
                    return (now - date) / (1000 * 60 * 60) <= lookbackHours;
                })
                .map(item => ({
                    id: item.guid || item.link,
                    title: item.title || "Flash Info",
                    link: item.link,
                    content: item.contentSnippet || item.content || "",
                    sourceTitle: feed.title || "Flux RSS",
                    imageUrl: this.extractImage(item)
                }));
        } catch (error) {
            console.error(`[Provider:RSS] Error fetching ${url}:`, error.message);
            return [];
        }
    }

    extractImage(item) {
        return (item.enclosure?.type?.startsWith('image') ? item.enclosure.url : null) ||
               item.mediaContent?.['$']?.url ||
               (item.contentEncoded || item.content || '').match(/<img[^>]+src=["'](https?:\/\/[^"'>]+)["']/i)?.[1]?.replace(/&/g, '&');
    }
}
