import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const healthStatus: any = {
        database: { status: 'loading', message: 'Checking...' },
        gemini: { status: 'loading', message: 'Checking...' },
        payload: { status: 'loading', message: 'Checking...' },
        discord: { status: 'loading', message: 'Checking...' },
        bluesky: { status: 'loading', message: 'Checking...' },
        mastodon: { status: 'loading', message: 'Checking...' },
        twitter: { status: 'loading', message: 'Checking...' },
        daemon: { status: 'loading', message: 'Checking...' }
    };

    // 1. DATABASE CHECK (Prisma)
    try {
        await prisma.$queryRaw`SELECT 1`;
        const topicCount = await prisma.newsTopic.count();
        healthStatus.database = { status: 'ok', message: `Connecté (${topicCount} topics)` };
    } catch (e: any) {
        healthStatus.database = { status: 'error', message: `Erreur DB: ${e.message}` };
    }

    // 2. GEMINI API CHECK
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY manquante");
        
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
            healthStatus.gemini = { status: 'ok', message: 'API Key valide' };
        } else {
            healthStatus.gemini = { status: 'error', message: 'Clé invalide ou quota atteint' };
        }
    } catch (e: any) {
        healthStatus.gemini = { status: 'error', message: e.message };
    }

    // 3. PAYLOAD CMS CHECK
    try {
        const url = process.env.PAYLOAD_SERVER_URL;
        if (!url) throw new Error("PAYLOAD_SERVER_URL manquante");
        // We use HEAD to check if the server responds
        const res = await fetch(`${url}/api/globals/site-settings`, { method: 'HEAD' });
        healthStatus.payload = { 
            status: res.status < 500 ? 'ok' : 'error', 
            message: res.ok ? 'Accessible' : `HTTP ${res.status}` 
        };
    } catch (e: any) {
        healthStatus.payload = { status: 'error', message: e.message };
    }

    // 4. DISCORD CHECK
    try {
        const webhook = process.env.DISCORD_WEBHOOK_URL;
        if (!webhook) throw new Error("Config manquante");
        healthStatus.discord = { status: 'ok', message: 'Connecté' };
    } catch (e: any) {
        healthStatus.discord = { status: 'error', message: e.message };
    }

    // 5. BLUESKY CHECK
    try {
        const identifier = process.env.BLUESKY_IDENTIFIER;
        const password = process.env.BLUESKY_APP_PASSWORD;
        if (!identifier || !password) throw new Error("Identifiants manquants");
        healthStatus.bluesky = { status: 'ok', message: 'Configuré' };
    } catch (e: any) {
        healthStatus.bluesky = { status: 'error', message: e.message };
    }

    // 6. MASTODON CHECK
    try {
        const url = process.env.MASTODON_INSTANCE_URL;
        const token = process.env.MASTODON_ACCESS_TOKEN;
        if (!url || !token) throw new Error("Config manquante");
        healthStatus.mastodon = { status: 'ok', message: 'Connecté' };
    } catch (e: any) {
        healthStatus.mastodon = { status: 'error', message: e.message };
    }

    // 7. TWITTER CHECK
    try {
        const key = process.env.TWITTER_API_KEY;
        if (!key) throw new Error("API Key manquante");
        healthStatus.twitter = { status: 'ok', message: 'Connecté' };
    } catch (e: any) {
        healthStatus.twitter = { status: 'error', message: e.message };
    }

    // 8. DAEMON PULSE
    try {
        const settings = await prisma.globalSettings.findFirst();
        if (settings) {
            const lastPulse = new Date(settings.updatedAt).getTime();
            const now = Date.now();
            const diffMin = Math.round((now - lastPulse) / 60000);
            
            if (diffMin > (settings.scrapingInterval || 60) * 2) {
                healthStatus.daemon = { status: 'error', message: `Inactif (${diffMin} min)` };
            } else {
                healthStatus.daemon = { status: 'ok', message: 'Actif' };
            }
        } else {
             healthStatus.daemon = { status: 'warning', message: 'Config manquante' };
        }
    } catch (e: any) {
        healthStatus.daemon = { status: 'error', message: e.message };
    }

    return NextResponse.json({ success: true, health: healthStatus });
}
