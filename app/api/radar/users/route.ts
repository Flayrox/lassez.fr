import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';

type SessionPayload = {
    username: string;
    role: string;
    permissions?: Record<string, boolean>;
    exp: number;
};

const ROLE_VALUES = ['admin', 'editor', 'viewer'];
const PERM_KEYS = ['radar', 'studio', 'network', 'lab', 'daemon', 'settings', 'users'];

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
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
    for (const key of PERM_KEYS) {
        if (key in input) base[key as keyof typeof base] = Boolean(input[key]);
    }
    return base;
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

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_radar_users_timestamp
        AFTER UPDATE ON radar_users
        FOR EACH ROW
        BEGIN
            UPDATE radar_users SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;
    `);
}

function hashPassword(password: string) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function readSession(req: Request): SessionPayload | null {
    const secret = process.env.RADAR_SESSION_SECRET;
    if (!secret) return null;

    const cookieHeader = req.headers.get('cookie') || '';
    const raw = cookieHeader
        .split(';')
        .map(x => x.trim())
        .find(x => x.startsWith('radar_session='));

    if (!raw) return null;
    const token = decodeURIComponent(raw.slice('radar_session='.length));
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, payload, signature] = parts;
    const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(`${header}.${payload}`)
        .digest('base64url');

    if (signature.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) return null;

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded?.exp || Date.now() > decoded.exp) return null;
    return decoded;
}

function canManageUsers(session: SessionPayload | null) {
    if (!session) return false;
    if (session.role === 'admin') return true;
    return Boolean(session.permissions?.users);
}

export async function GET(req: Request) {
    try {
        const session = readSession(req);
        if (!canManageUsers(session)) {
            return NextResponse.json({ success: false, error: 'Acces refuse.' }, { status: 403 });
        }

        const db = getDb();
        ensureUsersTable(db);

        const rows = db.prepare(`
            SELECT id, username, role, permissions, is_active, created_at, updated_at
            FROM radar_users
            ORDER BY role = 'admin' DESC, username ASC
        `).all() as any[];

        db.close();

        return NextResponse.json({
            success: true,
            users: rows.map(r => ({
                ...r,
                permissions: (() => {
                    try { return JSON.parse(r.permissions || '{}'); } catch { return {}; }
                })()
            }))
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = readSession(req);
        if (!canManageUsers(session)) {
            return NextResponse.json({ success: false, error: 'Acces refuse.' }, { status: 403 });
        }

        const body = await req.json();
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        const role = ROLE_VALUES.includes(String(body.role)) ? String(body.role) : 'viewer';
        const isActive = body.is_active === false ? 0 : 1;
        const permissions = normalizePermissions(body.permissions, role);

        if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
            return NextResponse.json({ success: false, error: 'Username invalide (3-32, alphanumerique, _.-).' }, { status: 400 });
        }
        if (password.length < 10) {
            return NextResponse.json({ success: false, error: 'Mot de passe trop court (10+).' }, { status: 400 });
        }

        const db = getDb();
        ensureUsersTable(db);

        const hash = hashPassword(password);
        db.prepare(`
            INSERT INTO radar_users (username, password_hash, role, permissions, is_active)
            VALUES (?, ?, ?, ?, ?)
        `).run(username, hash, role, JSON.stringify(permissions), isActive);

        db.close();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        if (String(error.message || '').includes('UNIQUE')) {
            return NextResponse.json({ success: false, error: 'Utilisateur deja existant.' }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: Request) {
    try {
        const session = readSession(req);
        if (!canManageUsers(session)) {
            return NextResponse.json({ success: false, error: 'Acces refuse.' }, { status: 403 });
        }

        const body = await req.json();
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, error: 'ID utilisateur invalide.' }, { status: 400 });
        }

        const db = getDb();
        ensureUsersTable(db);

        const existing = db.prepare('SELECT * FROM radar_users WHERE id = ?').get(id) as any;
        if (!existing) {
            db.close();
            return NextResponse.json({ success: false, error: 'Utilisateur introuvable.' }, { status: 404 });
        }

        const nextRole = ROLE_VALUES.includes(String(body.role)) ? String(body.role) : existing.role;
        const nextActive = body.is_active === undefined ? existing.is_active : (body.is_active ? 1 : 0);
        const nextPerms = normalizePermissions(body.permissions ?? JSON.parse(existing.permissions || '{}'), nextRole);

        const adminCount = db.prepare("SELECT COUNT(*) as c FROM radar_users WHERE role = 'admin' AND is_active = 1").get() as any;
        if (existing.role === 'admin' && existing.is_active === 1 && (nextRole !== 'admin' || nextActive !== 1) && Number(adminCount.c) <= 1) {
            db.close();
            return NextResponse.json({ success: false, error: 'Impossible de retirer le dernier admin actif.' }, { status: 400 });
        }

        if (body.password !== undefined && String(body.password).length > 0 && String(body.password).length < 10) {
            db.close();
            return NextResponse.json({ success: false, error: 'Mot de passe trop court (10+).' }, { status: 400 });
        }

        if (body.password !== undefined && String(body.password).length > 0) {
            db.prepare('UPDATE radar_users SET password_hash = ? WHERE id = ?')
                .run(hashPassword(String(body.password)), id);
        }

        db.prepare('UPDATE radar_users SET role = ?, permissions = ?, is_active = ? WHERE id = ?')
            .run(nextRole, JSON.stringify(nextPerms), nextActive, id);

        db.close();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const session = readSession(req);
        if (!canManageUsers(session)) {
            return NextResponse.json({ success: false, error: 'Acces refuse.' }, { status: 403 });
        }

        const body = await req.json();
        const id = Number(body.id);
        if (!Number.isInteger(id) || id <= 0) {
            return NextResponse.json({ success: false, error: 'ID utilisateur invalide.' }, { status: 400 });
        }

        const db = getDb();
        ensureUsersTable(db);

        const existing = db.prepare('SELECT * FROM radar_users WHERE id = ?').get(id) as any;
        if (!existing) {
            db.close();
            return NextResponse.json({ success: false, error: 'Utilisateur introuvable.' }, { status: 404 });
        }

        if (session?.username === existing.username) {
            db.close();
            return NextResponse.json({ success: false, error: 'Tu ne peux pas supprimer ton propre compte actif.' }, { status: 400 });
        }

        const adminCount = db.prepare("SELECT COUNT(*) as c FROM radar_users WHERE role = 'admin' AND is_active = 1").get() as any;
        if (existing.role === 'admin' && existing.is_active === 1 && Number(adminCount.c) <= 1) {
            db.close();
            return NextResponse.json({ success: false, error: 'Impossible de supprimer le dernier admin actif.' }, { status: 400 });
        }

        db.prepare('DELETE FROM radar_users WHERE id = ?').run(id);
        db.close();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
