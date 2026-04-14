import { getCMSProvider } from './cms-provider';

export function getServerWpApiBaseUrl() {
    if (process.env.NODE_ENV !== 'production') return 'http://localhost:5173/api/wp';
    if (process.env.IS_STUDIO) return 'https://lassez.fr/api/wp';
    return getCMSProvider() === 'payload' ? 'https://lassez.fr/api/wp' : 'https://lassez.fr/api/wp';
}
