import crypto from 'crypto';

/**
 * Vérifie le cookie `radar_session` (JWT maison HMAC-SHA256) posé par
 * /api/radar/login. Utilisé par les pages/APIs serveur du cockpit autonome.
 *
 * Retourne le payload décodé si le jeton est valide et non expiré, sinon null.
 */
export function verifyRadarSession(cookieValue: string | undefined | null): Record<string, any> | null {
    if (!cookieValue) return null;
    const secret = process.env.RADAR_SESSION_SECRET;
    if (!secret) return null;

    try {
        const parts = cookieValue.split('.');
        if (parts.length !== 3) return null;
        const [header, payload, signature] = parts;

        const expected = crypto
            .createHmac('sha256', secret)
            .update(`${header}.${payload}`)
            .digest('base64url');

        const provided = Buffer.from(signature, 'base64url');
        const expectedBuf = Buffer.from(expected, 'base64url');
        if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
            return null;
        }

        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
        if (typeof decoded.exp !== 'number' || Date.now() >= decoded.exp) {
            return null;
        }

        return decoded;
    } catch {
        return null;
    }
}

/** Raccourci booléen pour les gardes de route. */
export function hasRadarSession(cookieValue: string | undefined | null): boolean {
    return verifyRadarSession(cookieValue) !== null;
}
