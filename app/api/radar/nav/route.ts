import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { getNavItems } from '@/lib/db-nav';
import { NavItem } from '@/types';

export const dynamic = 'force-dynamic';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

// GET public — retourne les items de nav (tous, actifs et inactifs pour le Radar-Admin)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const all = searchParams.get('all') === '1';

        const navItems = await getNavItems(all);

        // Si on demande "all=1" (Radar-Admin), on ne veut pas de cache CDN agressif
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (all) {
            headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, proxy-revalidate';
            headers['Pragma'] = 'no-cache';
            headers['Expires'] = '0';
        } else {
            headers['Cache-Control'] = 's-maxage=60, stale-while-revalidate=30';
        }

        return NextResponse.json({ success: true, navItems }, { headers });
    } catch (error: any) {
        console.error('Erreur API nav (GET):', error);
        // Fallback hardcodé pour ne pas planter le header
        return NextResponse.json({
            success: true,
            navItems: [
                { slug: 'la-une', label: 'La Une', path: '/', enabled: true, badge: null, sort_order: 0 },
                { slug: 'enquetes', label: 'Enquêtes', path: '/enquetes', enabled: true, badge: null, sort_order: 1 },
                { slug: 'revelations', label: 'Flux Révélation', path: '/revelations', enabled: true, badge: null, sort_order: 2 },
                { slug: 'investigation', label: 'Investigation', path: '/investigation', enabled: true, badge: null, sort_order: 3 },
                { slug: 'comprendre', label: 'Comprendre', path: '/comprendre', enabled: true, badge: null, sort_order: 4 },
                { slug: 'elections', label: 'Élections', path: '/elections/municipales-2026', enabled: true, badge: 'LIVE', sort_order: 5 },
                { slug: 'soutenir', label: 'Soutenir', path: '/soutenir', enabled: true, badge: null, sort_order: 6 },
            ]
        });
    }
}

// PATCH protégé — toggle enabled pour un item de nav
// Appelé depuis le Radar-Admin (cookie de session requis)
export async function PATCH(request: Request) {
    let db;
    try {
        const body = await request.json();
        const { slug, enabled, badge } = body;

        if (!slug) {
            return NextResponse.json({ success: false, error: 'slug requis' }, { status: 400 });
        }

        db = getDb();
        const stmt = db.prepare(`
            UPDATE radar_nav_config SET enabled = ?, badge = ? WHERE slug = ?
        `);
        const result = stmt.run(enabled ? 1 : 0, badge ?? null, slug);
        
        if (result.changes === 0) {
            db.close();
            return NextResponse.json({ success: false, error: `Item "${slug}" non trouvé.` }, { status: 404 });
        }
        
        db.close();

        return NextResponse.json({ 
            success: true, 
            message: `Nav item "${slug}" mis à jour.`,
            updated: { slug, enabled }
        });
    } catch (error: any) {
        if (db) db.close();
        console.error('Erreur API nav (PATCH):', error);
        return NextResponse.json({ success: false, error: `Erreur base de données: ${error.message}` }, { status: 500 });
    }
}
