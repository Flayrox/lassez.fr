import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logToDaemon, errorToDaemon } from '../../logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Si hébergé sur Vercel, ça donne 5 min, si local, ça ne fait rien.

export async function POST(request: Request) {
    try {
        let action = 'scan';
        let electionSlugOverride = '';
        let customScan: any = null;
        try {
            const body = await request.json();
            const raw = String(body?.action || '').toLowerCase();
            if (raw === 'elections' || raw === 'election_sync') {
                action = 'elections';
            }
            electionSlugOverride = String(body?.slug || '').trim();
            if (body?.customScan) {
                customScan = body.customScan;
            }
        } catch (_) {
            // Empty body => default manual RSS scan
        }

        const scriptFile = action === 'elections' ? 'sync_elections.js' : 'index.js';
        const logPrefix = action === 'elections' ? 'MANUAL-ELECTIONS' : 'MANUAL-SCAN';
        const startLabel = action === 'elections' ? 'sync élections' : 'scan RSS/IA';

        const radarDir = path.join(process.cwd(), 'radar_lassez');
        const scriptPath = path.join(radarDir, scriptFile);
        let execCommand = `node "${scriptPath}"`;

        if (action === 'scan' && customScan) {
            const tempDir = path.join(radarDir, 'temp');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            const configFileName = `temp_scan_${Date.now()}.json`;
            const configFilePath = path.join(tempDir, configFileName);
            fs.writeFileSync(configFilePath, JSON.stringify(customScan));
            execCommand += ` --config "temp/${configFileName}"`;
        }

        const encoder = new TextEncoder();

        const customStream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`🚀 Démarrage ${startLabel} (Liaison Serveur)...\n`));

                // Cloner l'environnement et retirer NODE_OPTIONS pour empêcher Next.js
                // d'injecter son propre `fetch` patché dans notre processus Node natif,
                // ce qui causait l'erreur "fetch failed" avec Gemini.
                const cleanEnv = { ...process.env, FORCE_COLOR: '0' };
                delete (cleanEnv as any).NODE_OPTIONS;
                if (action === 'elections' && electionSlugOverride) {
                    (cleanEnv as any).ELECTION_SLUG_OVERRIDE = electionSlugOverride;
                }

                // Utilisation de exec au lieu de spawn pour Windows avec chemin contenant des espaces.
                // On met node en dur et on encapsule le chemin complet entre guillemets.
                const child = exec(execCommand, {
                    cwd: radarDir,
                    env: cleanEnv
                });

                if (child.stdout) {
                    child.stdout.on('data', (data) => {
                        const str = data.toString();
                        controller.enqueue(encoder.encode(str));
                        logToDaemon(`[${logPrefix}] ${str.trim()}`);
                    });
                }

                if (child.stderr) {
                    child.stderr.on('data', (data) => {
                        const str = data.toString();
                        controller.enqueue(encoder.encode(str));
                        errorToDaemon(`[${logPrefix}] ${str.trim()}`);
                    });
                }

                child.on('close', (code) => {
                    if (code === 0) {
                        controller.enqueue(encoder.encode(`\n✅ Opération terminée. Rafraîchissement de la liste...\n`));
                    } else {
                        controller.enqueue(encoder.encode(`\n⚠️ Opération terminée avec avertissements (Code ${code}). Rafraîchissement...\n`));
                    }
                    controller.close();
                });

                child.on('error', (err) => {
                    controller.enqueue(encoder.encode(`\n❌ Erreur de Processus: ${err.message}\n`));
                    controller.close();
                });
            }
        });

        return new Response(customStream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                'X-Content-Type-Options': 'nosniff',
            },
        });

    } catch (error: any) {
        errorToDaemon("Erreur API de Déclenchement Radar:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
