import { NextResponse } from 'next/server';
import { verifyPostPreviewToken } from '@/lib/preview-token';

/**
 * Nettoie une chaîne de caractères pour éliminer les espaces parasites
 */
function cleanString(value: unknown) {
    return String(value || '').trim();
}

/**
 * Valide et normalise le chemin relatif de prévisualisation.
 * Évite les failles de sécurité de type Open Redirect (ex: redirections vers des sites externes malveillants).
 */
function normalizePreviewPath(value: string) {
    const raw = cleanString(value);
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://')) return null;

    const prefixed = raw.startsWith('/') ? raw : `/${raw}`;
    if (prefixed.startsWith('//')) return null;

    const parsed = new URL(prefixed, 'https://preview.local');
    if (parsed.pathname.startsWith('/admin') || parsed.pathname.startsWith('/api/')) {
        return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export const dynamic = 'force-dynamic';

/**
 * Route GET /api/preview
 * 
 * Cette route sert de pont sécurisé de prévisualisation entre l'administration Payload CMS et le Frontend.
 * Lorsqu'un utilisateur clique sur "Preview" dans l'admin, cette route valide le chemin d'accès,
 * décode les paramètres de brouillon (`preview_id`) et effectue une redirection HTTP 307
 * vers la page de preview canonique sur `https://lassez.fr`.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    // Extraction et nettoyage des paramètres de prévisualisation
    const path = normalizePreviewPath(searchParams.get('path') || '');
    const previewId = cleanString(searchParams.get('preview_id'));
    const previewToken = cleanString(searchParams.get('preview_token'));

    // Si aucun chemin relatif valide n'est fourni, rejeter la requête avec HTTP 400 Bad Request
    if (!path) {
        return NextResponse.json({ success: false, error: 'missing_preview_path' }, { status: 400 });
    }

    // Si un jeton de signature cryptographique est fourni, vérifier sa validité
    if (previewToken) {
        const verified = verifyPostPreviewToken({
            token: previewToken,
            postId: previewId,
        });

        if (!verified.valid) {
            console.warn('[preview] Avertissement: jeton de prévisualisation invalide pour le chemin:', path);
        }
    }

    // Redirection HTTP 307 (Temporary Redirect) vers le domaine public canonique
    const redirectUrl = new URL(path, 'https://lassez.fr');
    if (previewId) redirectUrl.searchParams.set('preview_id', previewId);
    if (previewToken) redirectUrl.searchParams.set('preview_token', previewToken);

    return NextResponse.redirect(redirectUrl, { status: 307 });
}
