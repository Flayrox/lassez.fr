import 'dotenv/config';

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
        if (cleanHost.includes('lassez.fr')) {
            const parts = cleanHost.split('.');
            if (parts[0] === 'api' || parts[0] === 'studio') {
                parts.shift();
            }
            const frontendHost = parts.join('.');
            return `${currentProtocol}//${frontendHost}`;
        }
    }

    if (explicitEnvSite && !explicitEnvSite.includes('localhost')) {
        return explicitEnvSite;
    }

    // Default strict production fallback
    return 'https://lassez.fr';
}

export function getApiOrigin() {
    const explicit = normalizeUrl(process.env.PAYLOAD_SERVER_URL || '');
    if (explicit && !explicit.includes('localhost')) return explicit;

    const siteOrigin = getPublicSiteOrigin();
    if (siteOrigin.endsWith('lassez.fr')) {
        return 'https://api.lassez.fr';
    }

    return explicit || 'https://api.lassez.fr';
}