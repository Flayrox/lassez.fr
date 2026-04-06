import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { spawn } from 'child_process';
import { logToDaemon, errorToDaemon } from '../logger';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to get db connection
function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

let migrationDone = false;
let trendingCache: { data: { tag: string; count: number }[]; expires: number } = { data: [], expires: 0 };

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'PENDING';
        const geo = searchParams.get('geo'); // 'france' | 'international' | null
        const tag = searchParams.get('tag'); // filtre par tag

        const db = getDb();

        // Migration une seule fois par session serveur
        if (!migrationDone) {
            try {
                const cols = (db.pragma('table_info(radar_posts)') as any[]).map((c: any) => c.name);
                if (!cols.includes('geo')) db.exec("ALTER TABLE radar_posts ADD COLUMN geo TEXT DEFAULT 'france'");
                if (!cols.includes('tags')) db.exec("ALTER TABLE radar_posts ADD COLUMN tags TEXT DEFAULT ''");
            } catch (_) { }
            migrationDone = true;
        }

        // Query dynamique avec filtres optionnels
        let query = `SELECT id, source_url, source_title, flash_content, image_keyword, status, geo, tags, type_ouverture, fiabilite, video_path, created_at FROM radar_posts WHERE status = ?`;
        const params: any[] = [status];

        if (geo && geo !== 'all') {
            query += ` AND geo = ?`;
            params.push(geo);
        }
        if (tag) {
            query += ` AND tags LIKE ?`;
            params.push(`%${tag}%`);
        }

        query += ` ORDER BY created_at DESC LIMIT 1000`;
        const pendingPosts = db.prepare(query).all(...params);

        // Trending tags (cache 2 min pour perf)
        if (Date.now() > trendingCache.expires) {
            const trendingRows = (db.prepare(`
                SELECT tags FROM radar_posts 
                WHERE created_at >= datetime('now', '-7 days') AND tags != ''
                LIMIT 200
            `).all() as any[]);

            const tagCount: Record<string, number> = {};
            for (const row of trendingRows) {
                if (!row.tags) continue;
                (row.tags as string).split(',').forEach((t: string) => {
                    const cleaned = t.trim();
                    if (cleaned) tagCount[cleaned] = (tagCount[cleaned] || 0) + 1;
                });
            }
            trendingCache = {
                data: Object.entries(tagCount)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 12)
                    .map(([tag, count]) => ({ tag, count })),
                expires: Date.now() + 120000
            };
        }

        db.close();
        return NextResponse.json({ success: true, count: pendingPosts.length, posts: pendingPosts, trending_tags: trendingCache.data });
    } catch (error: any) {
        console.error("Erreur API Radar (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ids, status, flash_content, image_keyword, source_title } = body;

        const idsArray = ids || (id ? [id] : []);
        if (idsArray.length === 0 || !status) {
            return NextResponse.json({ success: false, error: 'ID(s) et Status requis' }, { status: 400 });
        }

        const validStatuses = ['APPROVED', 'REJECTED', 'PENDING', 'PUBLISHED', 'IGNORED'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: 'Status invalide' }, { status: 400 });
        }

        const db = getDb();

        let info;
        if (idsArray.length > 1) {
            const placeholders = idsArray.map(() => '?').join(',');
            info = db.prepare(`UPDATE radar_posts SET status = ? WHERE id IN (${placeholders})`).run(status, ...idsArray);
        } else {
            const singleId = idsArray[0];
            const updates = ['status = ?'];
            const values = [status];

            if (flash_content !== undefined) {
                updates.push('flash_content = ?');
                values.push(flash_content);
            }
            if (image_keyword !== undefined) {
                updates.push('image_keyword = ?');
                values.push(image_keyword);
            }
            if (source_title !== undefined) {
                updates.push('source_title = ?');
                values.push(source_title);
            }

            values.push(singleId);
            const setQuery = updates.join(', ');

            info = db.prepare(`UPDATE radar_posts SET ${setQuery} WHERE id = ?`).run(...values);
        }

        // 2. Si l'utilisateur clique sur "Publier Instant" (status = PUBLISHED)
        if (status === 'PUBLISHED') {
            for (const postId of idsArray) {
                logToDaemon(`[AUTO-PUBLISH] Lancement du pipeline d'image et upload WordPress pour ID ${postId}`);

                // On lance le processus indépendamment pour ne pas faire lagger l'UI Dashboard
                const scriptPath = path.join(process.cwd(), 'radar_lassez', 'publishPost.js');
                const publishProcess = spawn(process.execPath, [scriptPath, postId.toString()], {
                    detached: true,
                    stdio: 'ignore'
                });

                publishProcess.unref(); // Libère le process de Node Next.js
            }
        }

        db.close();

        if (info.changes === 0) {
            return NextResponse.json({ success: false, error: 'Article introuvable' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: `Statut modifié pour ${status}` });
    } catch (error: any) {
        errorToDaemon("Erreur API Radar (PATCH):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
