import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, unlink } from 'fs/promises';
import os from 'os';
import path from 'path';
// ffmpeg-static fournit le chemin vers le binaire ffmpeg précompilé pour la plateforme
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpegPath: string = require('ffmpeg-static');

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min max

const execFileAsync = promisify(execFile);

/**
 * POST /api/composite-video
 * Body: { videoUrl, overlayBase64, vx, vy, vw, vh }
 *
 * Composite un overlay HTML/PNG sur une vidéo MP4 à l'aide de ffmpeg-static.
 * ffmpeg-static est un binaire ffmpeg précompilé → pas besoin d'installer ffmpeg sur le système.
 *
 * Retourne : video/mp4 avec l'overlay incrusté
 */
export async function POST(req: NextRequest) {
    const tmpFiles: string[] = [];

    const cleanup = async () => {
        await Promise.allSettled(tmpFiles.map(f => unlink(f)));
    };

    try {
        const { videoUrl, overlayBase64, vx, vy, vw, vh } = await req.json();

        if (!videoUrl || !overlayBase64) {
            return NextResponse.json({ error: 'Paramètres manquants: videoUrl et overlayBase64 requis' }, { status: 400 });
        }

        const stamp = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const tmpDir = os.tmpdir();
        const videoPath = path.join(tmpDir, `lassez-input-${stamp}.mp4`);
        const overlayPath = path.join(tmpDir, `lassez-overlay-${stamp}.png`);
        const outputPath = path.join(tmpDir, `lassez-output-${stamp}.mp4`);
        tmpFiles.push(videoPath, overlayPath, outputPath);

        // ── 1. Télécharger la vidéo côté serveur (pas de CORS) ───────────────
        console.log(`[composite-video] Fetching video: ${videoUrl.slice(0, 80)}…`);
        const videoRes = await fetch(videoUrl, {
            headers: { 'User-Agent': 'lassez-studio/1.0' },
        });
        if (!videoRes.ok) {
            await cleanup();
            return NextResponse.json(
                { error: `Impossible de récupérer la vidéo: HTTP ${videoRes.status}` },
                { status: 502 }
            );
        }
        const videoBuffer = Buffer.from(await videoRes.arrayBuffer());
        await writeFile(videoPath, videoBuffer);

        // ── 2. Décoder l'overlay PNG (base64 dataURL → fichier) ──────────────
        const b64 = overlayBase64.replace(/^data:image\/\w+;base64,/, '');
        await writeFile(overlayPath, Buffer.from(b64, 'base64'));

        // ── 3. Construire le filtre ffmpeg ────────────────────────────────────
        // Étapes du filtre :
        //   [vid]  : vidéo source, scalée pour tenir dans la zone (vw×vh), letterbox noir
        //   [bg]   : fond noir 1080×1350 de durée arbitraire (shortest=1 la tronquera)
        //   [base] : fond + vidéo positionnée aux coords (vx, vy)
        //   [out]  : base + overlay PNG semi-transparent par-dessus, format yuv420p pour compatibilité max
        const filterComplex = [
            `[0:v]scale=${vw}:${vh}:force_original_aspect_ratio=decrease,` +
            `pad=${vw}:${vh}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[vid]`,
            `color=black:s=1080x1350:r=30:d=999[bg]`,
            `[bg][vid]overlay=${vx}:${vy}:shortest=1[base]`,
            `[base][1:v]overlay=0:0:format=auto,format=yuv420p[out]`,
        ].join(';');

        // ── 4. Exécuter ffmpeg-static ─────────────────────────────────────────
        const args = [
            '-y',                        // overwrite output sans demander
            '-i', videoPath,             // input 0 — vidéo
            '-i', overlayPath,           // input 1 — overlay PNG
            '-filter_complex', filterComplex,
            '-map', '[out]',             // stream vidéo composite
            '-map', '0:a?',              // audio original si présent
            '-c:v', 'libx264',
            '-preset', 'fast',
            '-crf', '22',
            '-threads', '2',             // <--- LIMITE HOSTINGER : Évite l'explosion du NPROC
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',   // streaming-friendly MP4
            '-shortest',
            outputPath,
        ];

        console.log(`[composite-video] Running ffmpeg with filter: ${filterComplex.slice(0, 120)}…`);
        const { stderr } = await execFileAsync(ffmpegPath, args, { maxBuffer: 100 * 1024 * 1024 });
        if (stderr) console.log(`[composite-video] ffmpeg stderr: ${stderr.slice(-300)}`);

        // ── 5. Lire le fichier de sortie et le renvoyer ───────────────────────
        const result = await readFile(outputPath);
        await cleanup();

        if (!result || result.length === 0) {
            return NextResponse.json({ error: 'FFmpeg a produit un fichier vide' }, { status: 500 });
        }

        console.log(`[composite-video] Done — output size: ${(result.length / 1024 / 1024).toFixed(1)} MB`);

        return new NextResponse(result, {
            status: 200,
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': 'attachment; filename="lassez-video-note.mp4"',
                'Content-Length': String(result.length),
            },
        });

    } catch (err: any) {
        await cleanup();
        console.error('[composite-video] Error:', err?.message ?? err);
        return NextResponse.json(
            { error: err?.message ?? 'Erreur inconnue lors du compositing' },
            { status: 500 }
        );
    }
}
