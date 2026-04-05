import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { spawn } from 'child_process';
import { logToDaemon, errorToDaemon } from '../../logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to get db connection
function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

export async function GET() {
    try {
        const db = getDb();
        const drafts = db.prepare(`SELECT * FROM radar_social_drafts ORDER BY created_at DESC LIMIT 100`).all();
        db.close();
        return NextResponse.json({ success: true, drafts });
    } catch (error: any) {
        errorToDaemon("Erreur API Social Custom (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { text, image_url, broadcast_now } = body;

        if (!text) {
            return NextResponse.json({ success: false, error: 'Le texte est requis' }, { status: 400 });
        }

        const db = getDb();
        const status = broadcast_now ? 'PUBLISHED' : 'DRAFT';

        const info = db.prepare(`
            INSERT INTO radar_social_drafts (text, image_url, status)
            VALUES (?, ?, ?)
        `).run(text, image_url || null, status);

        const draftId = info.lastInsertRowid;

        if (broadcast_now) {
            logToDaemon(`[SOCIAL-CUSTOM] Lancement du broadcast pour le post ID ${draftId}`);

            const scriptPath = path.join(process.cwd(), 'radar_lassez', 'broadcast_custom.js');
            const broadcastProcess = spawn(process.execPath, [scriptPath, text, image_url || ''], {
                detached: true,
                stdio: 'ignore',
                cwd: path.join(process.cwd(), 'radar_lassez')
            });

            broadcastProcess.unref();
        }

        db.close();

        return NextResponse.json({ 
            success: true, 
            message: broadcast_now ? 'Post diffusé avec succès' : 'Brouillon enregistré',
            id: draftId
        });
    } catch (error: any) {
        errorToDaemon("Erreur API Social Custom (POST):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
