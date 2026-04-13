import { WP_API_URL } from './api';

export function getServerWpApiBaseUrl() {
    if (process.env.NODE_ENV !== 'production') return WP_API_URL;
    if (process.env.IS_STUDIO) return WP_API_URL;
    return 'https://lassez.fr/api/wp';
}
