import { execFile } from 'child_process';
import path from 'path';
import type { PayloadHandler } from 'payload';

/**
 * Endpoint custom Payload : génère le visuel « L'Assez » d'un signal.
 *
 * Authentifié par Payload (single-login) — seul un admin peut générer un
 * visuel. Réutilise le générateur legacy recopié dans scripts/image-processor.mjs
 * (mode CLI : --title / --image / --keyword / --subtext), puis met à jour
 * `image_url` du signal avec l'URL publique du fichier généré.
 *
 * Exposé sur : POST /api/payload/radar/generate-image  { id }
 */
export const radarGenerateImageEndpoint: PayloadHandler = async (req) => {
    const user = req.user as { roles?: (string | { value: string })[] } | null;
    const roles = (user?.roles || []).map((r) => (typeof r === 'string' ? r : r?.value));
    if (!roles.includes('admin')) {
        return Response.json({ success: false, error: 'Accès refusé.' }, { status: 401 });
    }

    const body = (await req.json?.().catch(() => null)) || {};
    const id = body.id;
    if (!id) {
        return Response.json({ success: false, error: 'Identifiant du sujet manquant.' }, { status: 400 });
    }

    const signal = await req.payload.findByID({ collection: 'signals', id, depth: 0 }).catch(() => null);
    if (!signal) {
        return Response.json({ success: false, error: 'Sujet introuvable.' }, { status: 404 });
    }

    const draft = (signal.final_draft || {}) as Record<string, any>;
    const title = String(draft.headline || signal.source_title || 'L\'ASSEZ').trim();
    const keyword = String(
        (Array.isArray(draft.image_search_queries) && draft.image_search_queries[0]) ||
        draft.image_keyword ||
        signal.taxonomy ||
        'investigation',
    ).trim();
    const sourceImage = String(signal.image_url || '').trim();

    const scriptPath = path.join(process.cwd(), 'scripts', 'image-processor.mjs');
    const args = ['--title', title, '--keyword', keyword];
    if (sourceImage) args.push('--image', sourceImage);

    const run = () =>
        new Promise<{ stdout: string; code: number }>((resolve) => {
            execFile(
                process.execPath || 'node',
                [scriptPath, ...args],
                {
                    cwd: process.cwd(),
                    env: { ...process.env, FORCE_COLOR: '0' },
                    timeout: 120_000,
                },
                (err, stdout) => {
                    resolve({ stdout: String(stdout || ''), code: err ? (err as any).code ?? 1 : 0 });
                },
            );
        });

    const { stdout, code } = await run();
    // Le CLI imprime « ✅ /radar-images/xxx.jpg » en cas de succès.
    const match = stdout.match(/✅\s+(\/radar-images\/[^\s]+)/);
    if (code !== 0 || !match) {
        return Response.json(
            { success: false, error: `Échec de la génération du visuel. ${stdout.slice(-300)}` },
            { status: 500 },
        );
    }

    const origin = req.headers?.get?.('origin') || 'http://localhost:5173';
    const publicUrl = `${origin.replace(/\/+$/, '')}${match[1]}`;

    await req.payload.update({ collection: 'signals', id, data: { image_url: publicUrl } });

    return Response.json({ success: true, image_url: publicUrl });
};
