import 'dotenv/config';

export function getPublicSiteOrigin(req?: any) {
    // Always force production domain when in production or on VPS
    if (process.env.NODE_ENV === 'production') {
        return 'https://lassez.fr';
    }

    if (req && req.headers) {
        const hostHeader = typeof req.headers.get === 'function'
            ? (req.headers.get('x-forwarded-host') || req.headers.get('host'))
            : (req.headers['x-forwarded-host'] || req.headers['host']);

        if (hostHeader) {
            const cleanHost = String(hostHeader).toLowerCase().trim();
            if (cleanHost.includes('lassez.fr')) {
                return 'https://lassez.fr';
            }
        }
    }

    if (process.env.PAYLOAD_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) {
        const envUrl = process.env.PAYLOAD_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
        if (envUrl && !envUrl.includes('localhost')) {
            return envUrl.replace(/\/$/, '');
        }
    }

    return 'https://lassez.fr';
}

export function getApiOrigin() {
    if (process.env.NODE_ENV === 'production') {
        return 'https://api.lassez.fr';
    }
    return 'https://api.lassez.fr';
}