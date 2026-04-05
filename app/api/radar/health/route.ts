import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

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
        daemon: { status: 'loading', message: '' }
    };

    // 1. DATABASE
    try {
        const db = getDb();
        const test = db.prepare('SELECT 1 as val').get();
        if (test && (test as any).val === 1) {
            healthStatus.database = { status: 'ok', message: 'Connecté (SQLite)' };
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

    return NextResponse.json({ success: true, health: healthStatus });
}
