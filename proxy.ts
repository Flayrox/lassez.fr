import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple In-Memory Rate Limiter (Anti-Bruteforce & Spam)
// Note: En environnement Serverless (Vercel), ça reset à chaque cold boot,
// mais c'est suffisant pour décourager les scripts basiques.
const ipMap = new Map<string, { count: number, resetTime: number }>();
const MAX_REQ_PER_WINDOW = 30; // 30 requêtes autorisées
const WINDOW_MS = 60 * 1000; // par minute

function normalizeHostname(value: string) {
    return String(value || '')
        .split(',')[0]
        .trim()
        .toLowerCase();
}

function stripWww(hostname: string) {
    return hostname.replace(/^www\./, '');
}

function getPayloadOrigin(req: NextRequest, hostname: string) {
    const explicit = String(process.env.PAYLOAD_SERVER_URL || '').trim().replace(/\/$/, '');
    if (explicit) return explicit;

    const cleanHostname = stripWww(normalizeHostname(hostname)).replace(/^studio\./, '').replace(/^api\./, '');
    if (!cleanHostname || cleanHostname.includes('localhost') || cleanHostname.startsWith('127.')) {
        return req.nextUrl.origin;
    }

    return `https://api.${cleanHostname}`;
}

function isPayloadRoute(pathname: string) {
    return (
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname.startsWith('/api/payload') ||
        pathname.startsWith('/api/payload-graphql') ||
        pathname.startsWith('/api/payload-graphql-playground')
    );
}

function withRequestContext(req: NextRequest) {
    const headers = new Headers(req.headers);
    headers.set('x-request-host', normalizeHostname(req.headers.get('x-forwarded-host') || req.headers.get('host') || ''));
    headers.set('x-request-path', req.nextUrl.pathname);
    return headers;
}

export async function proxy(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const hostname = normalizeHostname(req.headers.get('x-forwarded-host') || req.headers.get('host') || '');
    const radarSecret = process.env.RADAR_SESSION_SECRET;
    const payloadOrigin = getPayloadOrigin(req, hostname);
    const isApiDomain = hostname.startsWith('api.');

    // Détection du sous-domaine
    // En local ça sera "studio.localhost", en prod "studio.lassez.fr"
    const isStudioDomain = hostname.startsWith('studio.');
    const isStudioRoute =
        pathname.startsWith('/radar-admin') ||
        pathname.startsWith('/api/radar') ||
        pathname.startsWith('/radar-login') ||
        pathname.startsWith('/api/elections') ||
        pathname.startsWith('/templates');

    if (isApiDomain) {
        if (pathname === '/') {
            return NextResponse.redirect(new URL('/admin', payloadOrigin));
        }

        if (!isPayloadRoute(pathname)) {
            return new NextResponse('Not Found', { status: 404 });
        }

        return NextResponse.next({
            request: {
                headers: withRequestContext(req),
            },
        });
    }

    if (isPayloadRoute(pathname)) {
        if (payloadOrigin === req.nextUrl.origin) {
            return NextResponse.next({
                request: {
                    headers: withRequestContext(req),
                },
            });
        }

        return NextResponse.redirect(new URL(`${pathname}${req.nextUrl.search}`, payloadOrigin));
    }

    // ─── 0. SÉPARATION DES DOMAINES ───
    if (!isStudioDomain) {
        // Le domaine public (lassez.fr) ne DOIT PAS accéder au back-end
        if (pathname.startsWith('/radar-admin') || pathname.startsWith('/radar-login') || pathname.startsWith('/templates')) {
            return NextResponse.redirect(new URL('/', req.url));
        }
        if (pathname.startsWith('/api/radar')) {
            return NextResponse.json({ success: false, error: 'Not Found' }, { status: 404 });
        }
    } else {
        // Sur le sous-domaine Studio, on redirige la racine (/) vers le dashboard
        if (pathname === '/') {
            return NextResponse.redirect(new URL('/radar-admin', req.url));
        }
        if (!isStudioRoute) {
            return new NextResponse('Not Found', { status: 404 });
        }
    }

    // Les routes publiques passent uniquement sur le domaine public.
    if (!isStudioRoute) {
        return NextResponse.next({
            request: {
                headers: withRequestContext(req),
            },
        });
    }

    // 1. RATE LIMITING SUR L'API RADAR (SAUF NAVIGATION)
    if (pathname.startsWith('/api/radar') && pathname !== '/api/radar/nav' && pathname !== '/api/radar/config') {
        const forwardedFor = req.headers.get('x-forwarded-for') || '';
        const ip = forwardedFor.split(',')[0]?.trim() || 'unknown';
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
        if (pathname.startsWith('/radar-admin') || pathname.startsWith('/radar-login') || pathname.startsWith('/templates')) {
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
        if (pathname.startsWith('/radar-admin') || pathname.startsWith('/templates')) {
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
        if (pathname.startsWith('/radar-admin/daemon')) return 'daemon';
        if (pathname.startsWith('/radar-admin/settings')) {
            const tab = req.nextUrl.searchParams.get('tab');
            if (tab === 'network') return 'network';
            if (tab === 'users') return 'users';
            return 'settings';
        }
        if (pathname.startsWith('/radar-admin/studio') || pathname.startsWith('/templates')) return 'studio';
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
        if (pathname.startsWith('/api/radar/daemon-status')) return 'daemon';
        if (pathname.startsWith('/api/radar/logs')) return 'daemon';
        if (pathname.startsWith('/api/radar/trigger')) return 'daemon';
        if (pathname.startsWith('/api/radar/settings')) {
            const scope = req.nextUrl.searchParams.get('scope');
            if (scope === 'network') return 'network';
            return 'settings';
        }
        return null;
    })();

    if (requiredApiPermission && role !== 'admin' && !permissions?.[requiredApiPermission]) {
        return NextResponse.json({ success: false, error: 'Permission refusee.' }, { status: 403 });
    }

    return NextResponse.next({
        request: {
            headers: withRequestContext(req),
        },
    });
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
