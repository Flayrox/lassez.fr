import Parser from 'rss-parser';

/**
 * Google News Provider
 * Fetches news based on topics or search queries using RSS.
 */
export class GoogleNewsProvider {
    constructor() {
        this.parser = new Parser();
    }

    async fetch(topicOrQuery, lookbackHours = 24) {
        console.log(`[Provider:GoogleNews] Fetching for: ${topicOrQuery}`);
        
        // URL formatting for Google News RSS
        const encodedQuery = encodeURIComponent(topicOrQuery);
        const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=fr&gl=FR&ceid=FR:fr`;

        try {
            const feed = await this.parser.parseURL(url);
            const now = new Date();
            const lookbackMs = lookbackHours * 60 * 60 * 1000;

            return feed.items
                .filter(item => {
                    const pubDate = new Date(item.pubDate);
                    return (now - pubDate) < lookbackMs;
                })
                .map(item => ({
                    id: item.guid || item.link,
                    title: item.title,
                    content: item.contentSnippet || item.content,
                    link: item.link,
                    pubDate: item.pubDate,
                    sourceTitle: 'Google News',
                    author: item.creator || 'Google News'
                }));
        } catch (error) {
            console.error('[Provider:GoogleNews] Error:', error.message);
            return [];
        }
    }
}
