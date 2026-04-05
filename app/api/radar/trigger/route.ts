import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { logToDaemon, errorToDaemon } from '../../logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Si hébergé sur Vercel, ça donne 5 min, si local, ça ne fait rien.

export async function POST() {
    try {
        const scriptPath = path.join(process.cwd(), 'radar_lassez', 'index.js');
        const radarDir = path.join(process.cwd(), 'radar_lassez');

        const encoder = new TextEncoder();

        const customStream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode("🚀 Démarrage du script (Liaison Serveur)...\n"));

                // Cloner l'environnement et retirer NODE_OPTIONS pour empêcher Next.js
                // d'injecter son propre `fetch` patché dans notre processus Node natif,
                // ce qui causait l'erreur "fetch failed" avec Gemini.
                const cleanEnv = { ...process.env, FORCE_COLOR: '0' };
                delete (cleanEnv as any).NODE_OPTIONS;

                const child = spawn(process.execPath, [scriptPath], {
                    cwd: radarDir,
                    env: cleanEnv
                });

                child.stdout.on('data', (data) => {
                    const str = data.toString();
                    controller.enqueue(encoder.encode(str));
                    logToDaemon(`[MANUAL-SCAN] ${str.trim()}`);
                });

                child.stderr.on('data', (data) => {
                    const str = data.toString();
                    controller.enqueue(encoder.encode(str));
                    errorToDaemon(`[MANUAL-SCAN] ${str.trim()}`);
                });

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
