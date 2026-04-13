import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

function getDb() {
    return new Database(path.join(process.cwd(), 'radar_lassez', 'radar.db'));
}

export async function GET() {
    const healthStatus: any = {
        database: { status: 'loading', message: '' },
        gemini: { status: 'loading', message: '' },
        wordpress: { status: 'loading', message: '' },
        mastodon: { status: 'loading', message: '' },
        bluesky: { status: 'loading', message: '' },
        twitter: { status: 'loading', message: '' },
        daemon: { status: 'loading', message: '' },
        ffmpeg: { status: 'loading', message: '' },
        ytdlp: { status: 'loading', message: '' },
        scrapers: { status: 'loading', message: '' }
    };
    let vitals: any = {
        posts: {},
        jobs: {},
        nextScanAt: null,
        lastScanAt: null,
        nextElectionScanAt: null,
        daemonRssEnabled: false,
        daemonElectionsEnabled: false
    };

    // 1. DATABASE + FTS5
    try {
        const db = getDb();
        const test = db.prepare('SELECT 1 as val').get();
        let ftsStatus = '';
        try {
            db.prepare('SELECT 1 FROM radar_archives LIMIT 1').get();
            ftsStatus = ' + Archives FTS5';
        } catch(e) {
            ftsStatus = ' (FTS5 Manquant)';
        }
        
        if (test && (test as any).val === 1) {
            healthStatus.database = { status: 'ok', message: 'Connecté (SQLite)' + ftsStatus };
        } else {
            healthStatus.database = { status: 'error', message: 'Erreur inattendue' };
        }
        db.close();
    } catch (e: any) {
        healthStatus.database = { status: 'error', message: e.message };
    }

    // 2. GEMINI
    try {
        if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY manquante");
        
        // Un simple test HTTP direct pour vérifier la clé sans charger tout le SDK
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:countTokens?key=${process.env.GEMINI_API_KEY}`;
        const res = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
        });
        
        if (res.ok) {
            healthStatus.gemini = { status: 'ok', message: 'Clé valide et connectée' };
        } else {
            healthStatus.gemini = { status: 'error', message: `Erreur API: ${res.statusText}` };
        }
    } catch (e: any) {
        healthStatus.gemini = { status: 'error', message: e.message };
    }

    // 3. WORDPRESS
    try {
        if (!process.env.WP_URL || !process.env.WP_USER || !process.env.WP_PASSWORD) throw new Error("Identifiants / URL manquants");
        
        const wpTokenEndpoint = `${process.env.WP_URL.replace(/\/$/, '')}/wp-json/jwt-auth/v1/token`;
        const res = await fetch(wpTokenEndpoint, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'User-Agent': 'lassez-radar/1.0'
            },
            body: JSON.stringify({
                username: process.env.WP_USER,
                password: process.env.WP_PASSWORD
            })
        });
        
        if (res.ok) {
            healthStatus.wordpress = { status: 'ok', message: 'Connecté' };
        } else {
            healthStatus.wordpress = { status: 'error', message: `Erreur HTTP ${res.status} (Accès refusé)` };
        }
    } catch (e: any) {
        healthStatus.wordpress = { status: 'error', message: e.message };
    }

    // 4. MASTODON
    try {
        if (!process.env.MASTODON_INSTANCE_URL) throw new Error("URL manquante");
        if (!process.env.MASTODON_ACCESS_TOKEN) throw new Error("Token manquant");
        
        const mstEndpoint = `${process.env.MASTODON_INSTANCE_URL.replace(/\/$/, '')}/api/v1/accounts/verify_credentials`;
        const res = await fetch(mstEndpoint, {
            headers: { 'Authorization': `Bearer ${process.env.MASTODON_ACCESS_TOKEN}` }
        });
        
        if (res.ok) {
            healthStatus.mastodon = { status: 'ok', message: 'Connecté' };
        } else {
            healthStatus.mastodon = { status: 'error', message: `Erreur ${res.status}` };
        }
    } catch (e: any) {
        healthStatus.mastodon = { status: 'error', message: e.message };
    }

    // 5. BLUESKY
    try {
        if (!process.env.BLUESKY_IDENTIFIER || !process.env.BLUESKY_APP_PASSWORD) {
            throw new Error("Identifiants manquants");
        }
        
        // On vérifie juste qu'on peut créer une session
        const bskyEndpoint = 'https://bsky.social/xrpc/com.atproto.server.createSession';
        const res = await fetch(bskyEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                identifier: process.env.BLUESKY_IDENTIFIER,
                password: process.env.BLUESKY_APP_PASSWORD
            })
        });
        
        if (res.ok) {
            healthStatus.bluesky = { status: 'ok', message: 'Session valide' };
        } else {
            healthStatus.bluesky = { status: 'error', message: `Mot de passe App ou Identifiant incorrect` };
        }
    } catch (e: any) {
        healthStatus.bluesky = { status: 'error', message: e.message };
    }

    // 6. TWITTER / X
    try {
        if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_SECRET || !process.env.TWITTER_ACCESS_TOKEN || !process.env.TWITTER_ACCESS_SECRET) {
            throw new Error("Clés (4) manquantes");
        }
        // Il est difficile de ping v2.me via un simple fetch à cause d'OAuth 1.0a,
        // donc on indique "OK (Configuré)" si les variables sont là.
        // Si les clés sont invalides, ça cassera au moment de publier, mais l'environnement est complet.
        healthStatus.twitter = { status: 'ok', message: 'Clés enregistrées' };
    } catch (e: any) {
        healthStatus.twitter = { status: 'error', message: e.message };
    }

    // 7. DAEMON RSS & PUBLISHER
    try {
        const db = getDb();
        const rs = db.prepare(`SELECT value FROM radar_settings WHERE key = 'next_scan_at'`).get() as any;
        db.close();

        if (rs && rs.value) {
            const nextScanTime = new Date(rs.value).getTime();
            const now = Date.now();
            
            // Si le daemon a crashé, le next_scan_at sera dans le passé depuis longtemps.
            // S'il est en retard de plus de 15 minutes, c'est considéré en panne.
            if (now > nextScanTime + (15 * 60 * 1000)) {
                healthStatus.daemon = { status: 'error', message: "Le Daemon semble arrêté (En retard)" };
            } else {
                healthStatus.daemon = { status: 'ok', message: "Actif (Scan programmé)" };
            }
        } else {
            healthStatus.daemon = { status: 'error', message: "Aucune information de scan trouvée" };
        }
    } catch (e: any) {
        healthStatus.daemon = { status: 'error', message: e.message };
    }

    // 8. FFMPEG
    try {
        execSync('ffmpeg -version', { stdio: 'ignore' });
        healthStatus.ffmpeg = { status: 'ok', message: 'Binaire disponible' };
    } catch (e: any) {
        healthStatus.ffmpeg = { status: 'error', message: 'Non trouvé (Binaire manquant)' };
    }

    // 9. YT-DLP
    try {
        execSync('yt-dlp --version', { stdio: 'ignore' });
        healthStatus.ytdlp = { status: 'ok', message: 'Binaire disponible' };
    } catch (e: any) {
        healthStatus.ytdlp = { status: 'error', message: 'Non trouvé (Binaire manquant)' };
    }

    // 10. SCRAPERS (Ping)
    try {
        const db = getDb();
        const rssFeedsRaw = db.prepare("SELECT value FROM radar_settings WHERE key = 'rss_feeds'").get() as any;
        db.close();
        let feeds: string[] = [];
        if (rssFeedsRaw && rssFeedsRaw.value) {
            try { feeds = JSON.parse(rssFeedsRaw.value); } catch(e){}
        }
        if (feeds.length > 0) {
            const firstFeed = feeds[0];
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            const feedRes = await fetch(firstFeed, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeoutId);
            
            if (feedRes && feedRes.ok) {
                healthStatus.scrapers = { status: 'ok', message: `Ping OK (${new URL(firstFeed).hostname})` };
            } else {
                healthStatus.scrapers = { status: 'warning', message: 'Flux injoignables ou lents' };
            }
        } else {
            healthStatus.scrapers = { status: 'ok', message: 'Aucun flux configuré' };
        }
    } catch(e: any) {
        healthStatus.scrapers = { status: 'error', message: e.message };
    }

    // 11. VITALS (queues + scans)
    try {
        const db = getDb();

        const postRows = db.prepare('SELECT status, COUNT(*) as c FROM radar_posts GROUP BY status').all() as any[];
        const postCounts: Record<string, number> = {};
        for (const row of postRows) postCounts[String(row.status || 'unknown')] = Number(row.c || 0);

        const jobCounts: Record<string, number> = {};
        try {
            const jobRows = db.prepare('SELECT status, COUNT(*) as c FROM radar_jobs GROUP BY status').all() as any[];
            for (const row of jobRows) jobCounts[String(row.status || 'unknown')] = Number(row.c || 0);
        } catch (_) {
            // optional table in some envs
        }

        const settingsRows = db.prepare(`
            SELECT key, value
            FROM radar_settings
            WHERE key IN (
                'next_scan_at',
                'last_scan_at',
                'next_election_scan_at',
                'daemon_rss_enabled',
                'daemon_elections_enabled'
            )
        `).all() as any[];

        const settingsMap: Record<string, string> = {};
        for (const row of settingsRows) settingsMap[String(row.key)] = String(row.value || '');

        vitals = {
            posts: postCounts,
            jobs: jobCounts,
            nextScanAt: settingsMap.next_scan_at || null,
            lastScanAt: settingsMap.last_scan_at || null,
            nextElectionScanAt: settingsMap.next_election_scan_at || null,
            daemonRssEnabled: settingsMap.daemon_rss_enabled !== 'false',
            daemonElectionsEnabled: settingsMap.daemon_elections_enabled === 'true'
        };

        db.close();
    } catch (_) {
        // keep default vitals payload
    }

    return NextResponse.json({ success: true, health: healthStatus, vitals });
}
