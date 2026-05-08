import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
    const healthStatus: any = {
        database: { status: 'loading', message: '' },
        gemini: { status: 'loading', message: '' },
        payload: { status: 'loading', message: '' },
        discord: { status: 'loading', message: '' },
        bluesky: { status: 'loading', message: '' },
        twitter: { status: 'loading', message: '' },
        daemon: { status: 'loading', message: '' },
        ffmpeg: { status: 'loading', message: '' },
        ytdlp: { status: 'loading', message: '' }
    };

    // 1. DATABASE CHECK (Prisma)
    try {
        await prisma.$queryRaw`SELECT 1`;
        const topicCount = await prisma.newsTopic.count();
        healthStatus.database = { status: 'ok', message: `Connecté (SQLite) - ${topicCount} topics` };
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
        const url = process.env.PAYLOAD_URL;
        if (!url) throw new Error("PAYLOAD_URL manquante");
        const res = await fetch(`${url}/api/globals/site-settings`, { method: 'HEAD' });
        healthStatus.payload = { status: res.ok ? 'ok' : 'error', message: res.ok ? 'Accessible' : `HTTP ${res.status}` };
    } catch (e: any) {
        healthStatus.payload = { status: 'error', message: e.message };
    }

    // 4. DISCORD CHECK (Webhook)
    try {
        const webhook = process.env.DISCORD_WEBHOOK_URL;
        if (!webhook) throw new Error("Webhook manquant");
        healthStatus.discord = { status: 'ok', message: 'Configuré' };
    } catch (e: any) {
        healthStatus.discord = { status: 'error', message: e.message };
    }

    // 5. DAEMON PULSE
    try {
        const settings = await prisma.globalSettings.findFirst();
        if (settings) {
            const lastPulse = new Date(settings.updatedAt).getTime();
            const now = Date.now();
            const diffMin = Math.round((now - lastPulse) / 60000);
            
            if (diffMin > (settings.scrapingInterval || 60) * 2) {
                healthStatus.daemon = { status: 'error', message: `Inactif (Dernier signal: ${diffMin} min)` };
            } else {
                healthStatus.daemon = { status: 'ok', message: 'Actif' };
            }
        }
    } catch (e: any) {
        healthStatus.daemon = { status: 'error', message: e.message };
    }

    // 6. BINARIES CHECK (System)
    const checkBinary = (cmd: string) => {
        try {
            execSync(`${cmd} -version`, { stdio: 'ignore' });
            return { status: 'ok', message: 'Disponible' };
        } catch {
            return { status: 'error', message: 'Non trouvé' };
        }
    };

    healthStatus.ffmpeg = checkBinary('ffmpeg');
    healthStatus.ytdlp = checkBinary('yt-dlp');

    return NextResponse.json({ success: true, health: healthStatus });
}
