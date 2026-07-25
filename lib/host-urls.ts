import 'dotenv/config';

/**
 * Résolveur canonique de l'origine publique du site frontend (https://lassez.fr)
 * 
 * En production, cette fonction garantit que les liens publics et de prévisualisation
 * pointent impérativement vers le domaine de production `https://lassez.fr`, en neutralisant
 * tout risque d'injection d'en-têtes internes Nginx (`localhost:3001`).
 * 
 * @param req Optionnel : Requête HTTP incidente (Server Side)
 * @returns Origine complète sous forme de chaîne (ex: 'https://lassez.fr' ou 'http://localhost:5173')
 */
export function getPublicSiteOrigin(req?: any) {
    // 1. En environnement de production (VPS / PM2), imposer l'origine canonique publique
    if (process.env.NODE_ENV === 'production') {
        return 'https://lassez.fr';
    }

    // 2. Détection côté client (Navigateur web)
    if (typeof window !== 'undefined' && window.location) {
        const host = window.location.host.toLowerCase();
        if (host.includes('localhost') || host.includes('127.0.0.1')) {
            return 'http://localhost:5173';
        }
        return 'https://lassez.fr';
    }

    // 3. Détection côté serveur via les en-têtes HTTP de la requête
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

    // 4. Utilisation de la variable d'environnement publique si configurée
    if (process.env.PAYLOAD_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL) {
        const envUrl = process.env.PAYLOAD_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL;
        if (envUrl && !envUrl.includes('localhost')) {
            return envUrl.replace(/\/$/, '');
        }
    }

    // Repli par défaut sur le domaine principal
    return 'https://lassez.fr';
}

/**
 * Résolveur d'origine pour l'API Payload CMS (https://api.lassez.fr)
 * 
 * Utilisé par Payload pour configurer serverURL, les autorisations CORS et CSRF.
 */
export function getApiOrigin() {
    if (process.env.NODE_ENV === 'production') {
        return 'https://api.lassez.fr';
    }
    return 'https://api.lassez.fr';
}