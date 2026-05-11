import axios from 'axios';

export class TelegramProvider {
    async fetch(handle) {
        console.log(`[Provider:Telegram] Scraping: @${handle}`);
        try {
            const url = `https://t.me/s/${handle}`;
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });
            const html = response.data;

            const messages = [];
            const msgRegex = /<div class="tgme_widget_message_text js-message_text[^>]*>([\s\S]*?)<\/div>/g;
            const linkRegex = /<a class="tgme_widget_message_date" href="(https:\/\/t\.me\/[^"]+)"/g;

            let match;
            const rawTexts = [];
            while ((match = msgRegex.exec(html)) !== null) {
                let text = match[1].replace(/<br\/?>/g, '\n').replace(/<[^>]*>/g, '').trim();
                if (text) rawTexts.push(text);
            }

            const links = [];
            while ((match = linkRegex.exec(html)) !== null) {
                links.push(match[1]);
            }

            const count = Math.min(rawTexts.length, links.length, 15);
            for (let i = 1; i <= count; i++) {
                messages.push({
                    id: links[links.length - i],
                    title: `Post Telegram @${handle}`,
                    content: rawTexts[rawTexts.length - i],
                    link: links[links.length - i],
                    sourceTitle: `Telegram @${handle}`,
                    imageUrl: null
                });
            }
            return messages;
        } catch (error) {
            console.error(`[Provider:Telegram] Error scraping @${handle}:`, error.message);
            throw error;
        }
    }
}
