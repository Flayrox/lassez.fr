import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple In-Memory Rate Limiter (Anti-Bruteforce & Spam)
// Note: En environnement Serverless (Vercel), ça reset à chaque cold boot,
// mais c'est suffisant pour décourager les scripts basiques.
const ipMap = new Map<string, { count: number, resetTime: number }>();
const MAX_REQ_PER_WINDOW = 30; // 30 requêtes autorisées
const WINDOW_MS = 60 * 1000; // par minute

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const hostname = req.headers.get('host') || '';
    const radarSecret = process.env.RADAR_SESSION_SECRET;

    // Détection du sous-domaine
    // En local ça sera "studio.localhost", en prod "studio.lassez.fr"
    const isStudioDomain = hostname.startsWith('studio.');

    // ─── 0. SÉPARATION DES DOMAINES ───
    if (!isStudioDomain) {
        // Le domaine public (lassez.fr) ne DOIT PAS accéder au back-end
        if (pathname.startsWith('/radar-admin') || pathname.startsWith('/radar-login')) {
            return NextResponse.redirect(new URL('/', req.url));
        }
    } else {
        // Sur le sous-domaine Studio, on redirige la racine (/) vers le dashboard
        if (pathname === '/') {
            return NextResponse.redirect(new URL('/radar-admin', req.url));
        }
    }

    // Si ce n'est pas une route sécurisée (Radar Admin, Login, ou API Radar), 
    // on laisse passer (ex: pages d'articles sur studio ou lassez.fr)
    if (!pathname.startsWith('/radar-admin') && !pathname.startsWith('/api/radar') && !pathname.startsWith('/radar-login')) {
        return NextResponse.next();
    }

    // 1. RATE LIMITING SUR L'API RADAR (SAUF NAVIGATION)
    if (pathname.startsWith('/api/radar') && pathname !== '/api/radar/nav' && pathname !== '/api/radar/config') {
        const forwardedFor = req.headers.get('x-forwarded-for') || '';
        const ip = forwardedFor.split(',')[0]?.trim() || req.ip || 'unknown';
        const now = Date.now();

        if (ipMap.has(ip)) {
            const data = ipMap.get(ip)!;
            if (now > data.resetTime) {
                ipMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
            } else {
                if (data.count >= MAX_REQ_PER_WINDOW) {
                    return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 });
                }
                data.count++;
            }
        } else {
            ipMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        }
    }

    // 2. EXCEPTIONS D'AUTHENTIFICATION
    // La route de login/logout et de navigation publique ne doit pas être bloquée
    if (pathname === '/api/radar/login' || pathname === '/api/radar/logout' || pathname === '/api/radar/nav' || pathname === '/api/radar/config') {
        return NextResponse.next();
    }

    // 3. VÉRIFICATION DU COOKIE (CRYPTOGRAPHIQUE)
    if (!radarSecret) {
        if (pathname.startsWith('/api/radar') && pathname !== '/api/radar/nav' && pathname !== '/api/radar/config') {
            return NextResponse.json({ success: false, error: 'Radar auth is not configured.' }, { status: 503 });
        }
        if (pathname.startsWith('/radar-admin') || pathname.startsWith('/radar-login')) {
            return NextResponse.redirect(new URL('/', req.url));
        }
    }

    const secretKeyStr = radarSecret as string;
    const sessionCookie = req.cookies.get('radar_session')?.value;

    let isAuthenticated = false;
    let sessionPayload: any = null;

    if (sessionCookie) {
        try {
            const parts = sessionCookie.split('.');
            if (parts.length === 3) {
                const header = parts[0];
                const payload = parts[1];
                const signature = parts[2];

                // a. Vérifier l'expiration
                const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
                if (Date.now() < decodedPayload.exp) {

                    // b. Vérifier la signature (Web Crypto API pour Edge runtime)
                    const encoder = new TextEncoder();
                    const keyData = encoder.encode(secretKeyStr);
                    const cryptoKey = await crypto.subtle.importKey(
                        'raw',
                        keyData,
                        { name: 'HMAC', hash: 'SHA-256' },
                        false,
                        ['verify']
                    );

                    const dataToVerify = encoder.encode(`${header}.${payload}`);
                    const signatureToVerify = Buffer.from(signature, 'base64url');

                    const isValidSignature = await crypto.subtle.verify(
                        'HMAC',
                        cryptoKey,
                        signatureToVerify,
                        dataToVerify
                    );

                    if (isValidSignature) {
                        isAuthenticated = true;
                        sessionPayload = decodedPayload;
                    }
                }
            }
        } catch (e) {
            // Ignorer l'erreur, isAuthenticated restera false
        }
    }

    // 4. GESTION DES REJETS
    if (!isAuthenticated) {
        // Redirection UI pour le Dashboard
        if (pathname.startsWith('/radar-admin')) {
            const loginUrl = new URL('/radar-login', req.url);
            // On nettoie le cookie potentiellement invalide ou expiré
            const response = NextResponse.redirect(loginUrl);
            response.cookies.delete('radar_session');
            return response;
        }

        // Erreur 401 absolue pour l'accès direct aux API Radar
        if (pathname.startsWith('/api/radar')) {
            return NextResponse.json({ success: false, error: 'Acces Refuse (Signature Invalide)' }, { status: 401 });
        }
    }

    // 5. CONTRÔLE FIN DES PERMISSIONS PAR ROUTE
    const role = sessionPayload?.role || 'viewer';
    const permissions = sessionPayload?.permissions || {};

    const requiredUiPermission = (() => {
        if (pathname.startsWith('/radar-admin/users')) return 'users';
        if (pathname.startsWith('/radar-admin/daemon')) return 'settings';
        if (pathname.startsWith('/radar-admin/settings')) return 'settings';
        if (pathname.startsWith('/radar-admin/studio')) return 'studio';
        if (pathname.startsWith('/radar-admin/network')) return 'network';
        if (pathname.startsWith('/radar-admin/lab')) return 'lab';
        if (pathname.startsWith('/radar-admin')) return 'radar';
        return null;
    })();

    if (requiredUiPermission && role !== 'admin' && !permissions?.[requiredUiPermission]) {
        if (pathname.startsWith('/radar-admin')) {
            return NextResponse.redirect(new URL('/radar-admin', req.url));
        }
    }

    const requiredApiPermission = (() => {
        if (pathname.startsWith('/api/radar/users')) return 'users';
        if (pathname.startsWith('/api/radar/daemon-status')) return 'settings';
        if (pathname.startsWith('/api/radar/settings')) return 'settings';
        if (pathname.startsWith('/api/radar/trigger')) return 'settings';
        return null;
    })();

    if (requiredApiPermission && role !== 'admin' && !permissions?.[requiredApiPermission]) {
        return NextResponse.json({ success: false, error: 'Permission refusee.' }, { status: 403 });
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images/ (public images)
         */
        '/((?!_next/static|_next/image|favicon.ico|images/).*)',
    ],
};
