function normalizeUrl(value: string) {
    const raw = String(value || '').trim().replace(/\/$/, '');
    if (!raw) return '';

    try {
        return new URL(raw).origin;
    } catch {
        return raw;
    }
}

export function getPublicSiteOrigin() {
    const previewOverride = normalizeUrl(
        process.env.PAYLOAD_PREVIEW_SITE_URL || process.env.PAYLOAD_PUBLIC_SITE_URL || ''
    );
    if (previewOverride) return previewOverride;

    const siteUrl = normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL || '');

    if (process.env.NODE_ENV !== 'production') {
        if (!siteUrl) return 'http://localhost:5173';
        return siteUrl || 'http://localhost:5173';
    }

    return siteUrl || 'https://lassez.fr';
}

export function getApiOrigin() {
    const explicit = normalizeUrl(process.env.PAYLOAD_SERVER_URL || '');
    if (explicit) return explicit;

    const siteOrigin = getPublicSiteOrigin();

    try {
        const url = new URL(siteOrigin);
        if (url.hostname.includes('localhost') || url.hostname.startsWith('127.')) {
            return url.origin;
        }

        const segments = url.hostname.split('.');
        if (segments[0] === 'www') {
            segments.shift();
        }

        if (segments.length > 0) {
            segments[0] = 'api';
            url.hostname = segments.join('.');
        }

        return url.origin;
    } catch {
        return 'https://api.lassez.fr';
    }
}