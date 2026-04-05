import Database from 'better-sqlite3';
import path from 'path';
import { NavItem } from '@/types';

/**
 * Fetch navigation items.
 * On the Studio (Hetzner), it reads from the local SQLite database.
 * On the Reader (Hostinger), it fetches from the Studio API via RADAR_API_URL.
 * 
 * @param all If true, returns all items including disabled ones.
 * @returns Array of NavItem
 */
export async function getNavItems(all: boolean = false): Promise<NavItem[]> {
    // 1. Check if we should use the Remote API (Hostinger case)
    const remoteUrl = process.env.RADAR_API_URL;
    if (remoteUrl && !process.env.IS_STUDIO) {
        try {
            const res = await fetch(`${remoteUrl}${all ? '?all=true' : ''}`, {
                next: { revalidate: 60 } // Cache for 1 minute
            });
            if (res.ok) {
                return await res.json();
            }
        } catch (error) {
            console.error('Failed to fetch remote nav items:', error);
            // Fallback to local logic/hardcoded if API is down
        }
    }

    // 2. Local SQLite Logic (Hetzner Studio case)
    let db: any = null;
    try {
        const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
        db = new Database(dbPath);

        // Ensure table exists (idempotent)
        db.exec(`
            CREATE TABLE IF NOT EXISTS radar_nav_config (
                slug TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                path TEXT NOT NULL,
                enabled INTEGER DEFAULT 1,
                badge TEXT,
                sort_order INTEGER DEFAULT 99
            )
        `);

        // Seed if empty
        const countRow = db.prepare('SELECT COUNT(*) as c FROM radar_nav_config').get() as { c: number };
        if (countRow && countRow.c === 0) {
            const insert = db.prepare(`
                INSERT OR IGNORE INTO radar_nav_config (slug, label, path, enabled, badge, sort_order)
                VALUES (?, ?, ?, ?, ?, ?)
            `);
            
            const defaults = [
                ['la-une', 'La Une', '/', 1, null, 0],
                ['enquetes', 'Enquêtes', '/enquetes', 1, null, 1],
                ['revelations', 'Flux Révélation', '/revelations', 1, null, 2],
                ['investigation', 'Investigation', '/investigation', 1, null, 3],
                ['comprendre', 'Comprendre', '/comprendre', 1, null, 4],
                ['elections', 'Élections', '/elections/municipales-2026', 1, 'LIVE', 5],
                ['soutenir', 'Soutenir', '/soutenir', 1, null, 6],
            ];

            const transaction = db.transaction((items: any[][]) => {
                for (const d of items) {
                    insert.run(...d);
                }
            });
            transaction(defaults);
        }

        const query = all
            ? 'SELECT * FROM radar_nav_config ORDER BY sort_order ASC'
            : 'SELECT * FROM radar_nav_config WHERE enabled = 1 ORDER BY sort_order ASC';

        const rows = db.prepare(query).all() as any[];
        
        return rows.map((r: any) => ({
            slug: r.slug,
            label: r.label,
            path: r.path,
            enabled: r.enabled === 1,
            badge: r.badge || null,
            sort_order: r.sort_order,
        }));
    } catch (error) {
        console.error('Error in getNavItems:', error);
        // Fallback hardcoded for safety
        const fallback: NavItem[] = [
            { slug: 'la-une', label: 'La Une', path: '/', enabled: true, badge: null, sort_order: 0 },
            { slug: 'enquetes', label: 'Enquêtes', path: '/enquetes', enabled: true, badge: null, sort_order: 1 },
            { slug: 'revelations', label: 'Flux Révélation', path: '/revelations', enabled: true, badge: null, sort_order: 2 },
            { slug: 'investigation', label: 'Investigation', path: '/investigation', enabled: true, badge: null, sort_order: 3 },
            { slug: 'comprendre', label: 'Comprendre', path: '/comprendre', enabled: true, badge: null, sort_order: 4 },
            { slug: 'elections', label: 'Élections', path: '/elections/municipales-2026', enabled: true, badge: 'LIVE', sort_order: 5 },
            { slug: 'soutenir', label: 'Soutenir', path: '/soutenir', enabled: true, badge: null, sort_order: 6 },
        ];
        
        if (all) return fallback;
        return fallback.filter(item => item.enabled);
    } finally {
        if (db) db.close();
    }
}
