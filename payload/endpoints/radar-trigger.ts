import { exec } from 'child_process';
import path from 'path';
import type { PayloadHandler } from 'payload';

/**
 * Endpoint custom Payload : déclenche un cycle du pipeline Radar.
 *
 * Authentifié par Payload (single-login) — seul un admin peut lancer un scan.
 * Monte un process `manual_trigger.ts` et streame sa sortie vers le client.
 *
 * Exposé sur : POST /api/payload/radar/trigger
 */
export const radarTriggerEndpoint: PayloadHandler = (req) => {
    const user = req.user as { roles?: (string | { value: string })[] } | null;
    const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r?.value));
    if (!roles.includes('admin')) {
        return Response.json({ success: false, error: 'Accès refusé.' }, { status: 401 });
    }

    const radarDir = path.join(process.cwd(), 'radar_lassez');
    const scriptPath = path.join(radarDir, 'manual_trigger.ts');
    const execCommand = `npx tsx "${scriptPath}"`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            controller.enqueue(encoder.encode("🚀 Démarrage du cycle d'investigation…\n"));

            const cleanEnv = { ...process.env, FORCE_COLOR: '0' };
            delete (cleanEnv as { NODE_OPTIONS?: string }).NODE_OPTIONS;

            const child = exec(execCommand, {
                cwd: process.cwd(),
                env: cleanEnv,
            });

            let isClosed = false;

            const safeEnqueue = (data: string) => {
                if (isClosed) return;
                try {
                    controller.enqueue(encoder.encode(data));
                } catch {
                    isClosed = true;
                }
            };

            const safeClose = () => {
                if (isClosed) return;
                isClosed = true;
                try {
                    controller.close();
                } catch {}
            };

            if (child.stdout) {
                child.stdout.on('data', (data) => safeEnqueue(data.toString()));
            }
            if (child.stderr) {
                child.stderr.on('data', (data) => safeEnqueue(data.toString()));
            }

            child.on('close', (code) => {
                safeEnqueue(code === 0 ? '\n✅ Cycle terminé avec succès.\n' : `\n⚠️ Cycle terminé avec le code ${code}.\n`);
                safeClose();
            });

            child.on('error', (err) => {
                safeEnqueue(`\n❌ Erreur de processus: ${err.message}\n`);
                safeClose();
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
        },
    });
};
