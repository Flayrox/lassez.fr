import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

export const dynamic = 'force-dynamic';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

function ensureTable(db: any) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS elections_override (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_slug TEXT NOT NULL DEFAULT 'municipales-2026',
            ville TEXT NOT NULL,
            candidat TEXT NOT NULL,
            parti TEXT,
            couleur TEXT DEFAULT '#888888',
            pct REAL NOT NULL DEFAULT 0,
            voix INTEGER DEFAULT 0,
            elu INTEGER DEFAULT 0,
            active INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT (datetime('now'))
        )
    `);
}

// GET — liste tous les overrides (pour le Radar-Admin)
export async function GET() {
    try {
        const db = getDb();
        ensureTable(db);
        const rows = db.prepare('SELECT * FROM elections_override ORDER BY election_slug, ville, pct DESC').all();
        db.close();
        return NextResponse.json({ success: true, overrides: rows });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST — créer ou remplacer un override
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { election_slug = 'municipales-2026', ville, candidat, parti, couleur, pct, voix, elu, active } = body;

        if (!ville || !candidat || pct === undefined) {
            return NextResponse.json({ success: false, error: 'ville, candidat, pct requis' }, { status: 400 });
        }

        const db = getDb();
        ensureTable(db);

        // Upsert : si même ville+candidat+election_slug → update
        const existing = db.prepare(`
            SELECT id FROM elections_override WHERE election_slug = ? AND ville = ? AND candidat = ?
        `).get(election_slug, ville, candidat) as any;

        if (existing) {
            db.prepare(`
                UPDATE elections_override SET parti = ?, couleur = ?, pct = ?, voix = ?, elu = ?, active = ?, updated_at = datetime('now')
                WHERE id = ?
            `).run(parti ?? null, couleur ?? '#888888', pct, voix ?? 0, elu ? 1 : 0, active !== false ? 1 : 0, existing.id);
        } else {
            db.prepare(`
                INSERT INTO elections_override (election_slug, ville, candidat, parti, couleur, pct, voix, elu, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(election_slug, ville, candidat, parti ?? null, couleur ?? '#888888', pct, voix ?? 0, elu ? 1 : 0, active !== false ? 1 : 0);
        }

        db.close();
        return NextResponse.json({ success: true, message: `Override ${ville} / ${candidat} enregistré.` });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE — supprimer un override par ID
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ success: false, error: 'id requis' }, { status: 400 });

        const db = getDb();
        ensureTable(db);
        db.prepare('DELETE FROM elections_override WHERE id = ?').run(id);
        db.close();
        return NextResponse.json({ success: true, message: `Override #${id} supprimé.` });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
