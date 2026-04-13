import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';

const rateLimitMap = new Map<string, { count: number, resetTime: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

function ensureUsersTable(db: Database.Database) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS radar_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin', 'editor', 'viewer')),
            permissions TEXT NOT NULL DEFAULT '{}',
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
}

function hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password: string, encoded: string) {
    const [salt, hashHex] = String(encoded || '').split(':');
    if (!salt || !hashHex) return false;
    const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
    if (candidate.length !== hashHex.length) return false;
    return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hashHex));
}

function normalizePermissions(input: any, role: string) {
    if (role === 'admin') {
        return {
            radar: true,
            studio: true,
            network: true,
            lab: true,
            daemon: true,
            settings: true,
            users: true
        };
    }

    const base = {
        radar: true,
        studio: false,
        network: false,
        lab: false,
        daemon: false,
        settings: false,
        users: false
    };

    if (!input || typeof input !== 'object') return base;
    for (const key of Object.keys(base)) {
        if (key in input) (base as any)[key] = Boolean(input[key]);
    }
    return base;
}

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

        let authUsername = '';
        let authRole = 'viewer';
        let authPermissions: Record<string, boolean> = {
            radar: true,
            studio: false,
            network: false,
            lab: false,
            daemon: false,
            settings: false,
            users: false
        };
        let isAuthenticated = false;

        // 1) Auth DB (multi-users)
        try {
            const db = getDb();
            ensureUsersTable(db);

            // Seed admin user from env if table empty and env is configured
            const usersCount = db.prepare('SELECT COUNT(*) as c FROM radar_users').get() as any;
            if (Number(usersCount?.c || 0) === 0 && validPwd) {
                db.prepare(`
                    INSERT OR IGNORE INTO radar_users (username, password_hash, role, permissions, is_active)
                    VALUES (?, ?, 'admin', ?, 1)
                `).run(
                    validUser,
                    hashPassword(validPwd),
                    JSON.stringify({ radar: true, studio: true, network: true, lab: true, daemon: true, settings: true, users: true })
                );
            }

            const userRow = db.prepare('SELECT username, password_hash, role, permissions, is_active FROM radar_users WHERE username = ?').get(String(username).trim()) as any;
            db.close();

            if (userRow && Number(userRow.is_active) === 1 && verifyPassword(String(password), userRow.password_hash)) {
                isAuthenticated = true;
                authUsername = userRow.username;
                authRole = userRow.role || 'viewer';
                authPermissions = normalizePermissions((() => {
                    try { return JSON.parse(userRow.permissions || '{}'); } catch { return {}; }
                })(), authRole);
            }
        } catch (_) {
            // On garde fallback env ci-dessous
        }

        // 2) Fallback env (compat)
        if (!isAuthenticated) {
            const isUserValid = username.length === validUser.length && crypto.timingSafeEqual(Buffer.from(username), Buffer.from(validUser));
            const isPwdValid = password.length === validPwd.length && crypto.timingSafeEqual(Buffer.from(password), Buffer.from(validPwd));
            if (isUserValid && isPwdValid) {
                isAuthenticated = true;
                authUsername = validUser;
                authRole = 'admin';
                authPermissions = { radar: true, studio: true, network: true, lab: true, daemon: true, settings: true, users: true };
            }
        }

        if (!isAuthenticated) {
            return NextResponse.json({ success: false, error: 'Identifiants invalides.' }, { status: 401 });
        }

        // Succès : Réinitialiser le compteur
        rateLimitMap.delete(ip);

        // Création d'un Jeton JWT Maison avec HMAC-SHA256
        const expirationMs = now + (1000 * 60 * 60 * 24 * 7); // Expire dans 7 jours
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            username: authUsername,
            role: authRole,
            permissions: authPermissions,
            exp: expirationMs
        })).toString('base64url');

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
