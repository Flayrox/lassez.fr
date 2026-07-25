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
    if (typeof window !== 'undefined' && window.location) {
        const host = window.location.host.toLowerCase();
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            return 'http://localhost:5173';
        }
        return 'https://lassez.fr';
    }

    if (req && req.headers) {
        const hostHeader = typeof req.headers.get === 'function'
            ? (req.headers.get('x-forwarded-host') || req.headers.get('host'))
            : (req.headers['x-forwarded-host'] || req.headers['host']);
        
        if (hostHeader) {
            const cleanHost = String(hostHeader).toLowerCase().trim();
            if (cleanHost.includes('localhost') || cleanHost.includes('127.0.0.1')) {
                return 'http://localhost:5173';
            }
        }
    }

    // Default production fallback
    return 'https://lassez.fr';
}

export function getApiOrigin() {
    if (typeof window !== 'undefined' && window.location) {
        const host = window.location.host.toLowerCase();
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            return 'http://api.localhost:5173';
        }
        return 'https://api.lassez.fr';
    }

    return 'https://api.lassez.fr';
}