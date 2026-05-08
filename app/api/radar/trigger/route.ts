import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; 

export async function POST(request: Request) {
    try {
        const radarDir = path.join(process.cwd(), 'radar_lassez');
        const scriptPath = path.join(radarDir, 'manual_trigger.ts');
        
        // On utilise npx tsx pour exécuter le script TypeScript directement
        const execCommand = `npx tsx "${scriptPath}"`;

        console.log(`[API:Trigger] Executing: ${execCommand}`);

        const encoder = new TextEncoder();

        const customStream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`🚀 Démarrage du cycle d'investigation (V3)...\n`));

                const cleanEnv = { ...process.env, FORCE_COLOR: '0' };
                delete (cleanEnv as any).NODE_OPTIONS;

                const child = exec(execCommand, {
                    cwd: process.cwd(),
                    env: cleanEnv
                });

                let isClosed = false;

                const safeEnqueue = (data: string) => {
                    if (isClosed) return;
                    try {
                        controller.enqueue(encoder.encode(data));
                    } catch (e) {
                        isClosed = true;
                    }
                };

                const safeClose = () => {
                    if (isClosed) return;
                    try {
                        isClosed = true;
                        controller.close();
                    } catch (e) {}
                };

                if (child.stdout) {
                    child.stdout.on('data', (data) => {
                        safeEnqueue(data.toString());
                    });
                }

                if (child.stderr) {
                    child.stderr.on('data', (data) => {
                        safeEnqueue(data.toString());
                    });
                }

                child.on('close', (code) => {
                    if (code === 0) {
                        safeEnqueue(`\n✅ Cycle terminé avec succès.\n`);
                    } else {
                        safeEnqueue(`\n⚠️ Le cycle s'est terminé avec le code ${code}.\n`);
                    }
                    safeClose();
                });

                child.on('error', (err) => {
                    safeEnqueue(`\n❌ Erreur de Processus: ${err.message}\n`);
                    safeClose();
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
        console.error("Erreur API de Déclenchement Radar:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
