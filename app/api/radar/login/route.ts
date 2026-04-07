import { NextResponse } from 'next/server';
import crypto from 'crypto';

const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: Request) {
    try {
        const forwardedFor = req.headers.get('x-forwarded-for') || '';
        const ip = forwardedFor.split(',')[0]?.trim() || 'unknown';
        const now = Date.now();

        // Rate Limiting (Anti-Bruteforce)
        if (rateLimitMap.has(ip)) {
            const data = rateLimitMap.get(ip)!;
            if (now > data.resetTime) {
                rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
            } else {
                if (data.count >= MAX_ATTEMPTS) {
                    return NextResponse.json({ success: false, error: 'Trop de tentatives. Compte bloqué temporairement.' }, { status: 429 });
                }
                rateLimitMap.set(ip, { count: data.count + 1, resetTime: data.resetTime });
            }
        } else {
            rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        }

        const body = await req.json();
        const { username, password } = body;

        const validUser = process.env.RADAR_ADMIN_USER || 'admin';
        const validPwd = process.env.RADAR_ADMIN_PASSWORD;
        const secret = process.env.RADAR_SESSION_SECRET;

        if (!validPwd || !secret) {
            console.error('[RADAR-AUTH] Missing required env vars: RADAR_ADMIN_PASSWORD and/or RADAR_SESSION_SECRET');
            return NextResponse.json({ success: false, error: 'Configuration serveur invalide.' }, { status: 503 });
        }

        // Timing-Safe Comparison to prevent Timing Attacks
        const isUserValid = username.length === validUser.length && crypto.timingSafeEqual(Buffer.from(username), Buffer.from(validUser));
        const isPwdValid = password.length === validPwd.length && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(validPwd));

        if (!isUserValid || !isPwdValid) {
            return NextResponse.json({ success: false, error: 'Identifiants invalides.' }, { status: 401 });
        }

        // Succès : Réinitialiser le compteur
        rateLimitMap.delete(ip);

        // Création d'un Jeton JWT Maison avec HMAC-SHA256
        const expirationMs = now + (1000 * 60 * 60 * 24 * 7); // Expire dans 7 jours
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({ role: 'admin', exp: expirationMs })).toString('base64url');

        const signature = crypto.createHmac('sha256', secret)
            .update(`${header}.${payload}`)
            .digest('base64url');

        const token = `${header}.${payload}.${signature}`;

        const response = NextResponse.json({ success: true, message: 'Connexion réussie.' });

        response.cookies.set('radar_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 semaine
        });

        return response;

    } catch (error: any) {
        return NextResponse.json({ success: false, error: 'Erreur serveur.' }, { status: 500 });
    }
}
