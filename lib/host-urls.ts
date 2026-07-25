function normalizeUrl(value: string) {
    const raw = String(value || '').trim().replace(/\/$/, '');
    if (!raw) return '';

    try {
        return new URL(raw).origin;
    } catch {
        return raw;
    }
}

export function getPublicSiteOrigin(req?: any) {
    const explicitEnvSite = normalizeUrl(
        process.env.PAYLOAD_PREVIEW_SITE_URL ||
        process.env.PAYLOAD_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.FRONTEND_URL ||
        ''
    );

    const isExplicitProductionUrl = explicitEnvSite &&
        !explicitEnvSite.includes('localhost') &&
        !explicitEnvSite.includes('127.0.0.1');

    let currentHost = '';
    let currentProtocol = 'https:';

    if (typeof window !== 'undefined' && window.location) {
        currentHost = window.location.host;
        currentProtocol = window.location.protocol;
    } else if (req) {
        const headers = req.headers;
        if (headers) {
            const hostHeader = typeof headers.get === 'function'
                ? (headers.get('x-forwarded-host') || headers.get('host'))
                : (headers['x-forwarded-host'] || headers['host']);
            if (hostHeader) {
                currentHost = String(hostHeader).trim();
            }
            const protoHeader = typeof headers.get === 'function'
                ? headers.get('x-forwarded-proto')
                : headers['x-forwarded-proto'];
            if (protoHeader) {
                currentProtocol = String(protoHeader).trim() + ':';
            }
        }
    }

    if (currentHost) {
        const cleanHost = currentHost.toLowerCase();
        const isLoopbackHost = cleanHost.includes('localhost') ||
            cleanHost.startsWith('127.') ||
            cleanHost.startsWith('0.0.0.0') ||
            cleanHost === '::1';

        if (isLoopbackHost) {
            if (process.env.NODE_ENV === 'production' || isExplicitProductionUrl) {
                return explicitEnvSite || 'https://lassez.fr';
            }
            if (cleanHost.includes(':')) {
                return `${currentProtocol}//${cleanHost}`;
            }
            return `${currentProtocol}//localhost:5173`;
        }

        const parts = cleanHost.split('.');
        if (parts[0] === 'api' || parts[0] === 'studio') {
            parts.shift();
        }
        const frontendHost = parts.join('.');
        return `${currentProtocol}//${frontendHost}`;
    }

    if (process.env.NODE_ENV !== 'production' && !isExplicitProductionUrl) {
        return explicitEnvSite || 'http://localhost:5173';
    }

    return explicitEnvSite || 'https://lassez.fr';
}

export function getApiOrigin() {
    const explicit = normalizeUrl(process.env.PAYLOAD_SERVER_URL || '');
    if (explicit && !explicit.includes('localhost')) return explicit;

    const siteOrigin = getPublicSiteOrigin();

    try {
        const url = new URL(siteOrigin);
        if (url.hostname.includes('localhost') || url.hostname.startsWith('127.')) {
            return explicit || url.origin;
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
        return explicit || 'https://api.lassez.fr';
    }
}