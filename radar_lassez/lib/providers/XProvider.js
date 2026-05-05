import { RSSProvider } from './RSSProvider.js';

export class XProvider extends RSSProvider {
    constructor(bridgeBaseUrl) {
        super();
        this.baseUrl = bridgeBaseUrl.replace(/\/$/, '');
    }

    async fetchAccount(username, lookbackHours = 24) {
        const cleanUser = username.replace(/^@/, '').trim();
        const feedUrl = `${this.baseUrl}/?action=display&bridge=TwitterBridge&context=By+username&u=${encodeURIComponent(cleanUser)}&format=Atom`;
        const items = await super.fetch(feedUrl, lookbackHours);
        return items.map(item => ({
            ...item,
            sourceTitle: `X / @${cleanUser}`
        }));
    }
}
