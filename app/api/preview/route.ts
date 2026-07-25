import { NextResponse } from 'next/server';
import { verifyPostPreviewToken } from '@/lib/preview-token';
import { getPublicSiteOrigin } from '@/lib/host-urls';

function cleanString(value: unknown) {
    return String(value || '').trim();
}

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

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const path = normalizePreviewPath(searchParams.get('path') || '');
    const previewId = cleanString(searchParams.get('preview_id'));
    const previewToken = cleanString(searchParams.get('preview_token'));

    if (!path || !previewId || !previewToken) {
        return NextResponse.json({ success: false, error: 'missing_preview_params' }, { status: 400 });
    }

    const verified = verifyPostPreviewToken({
        token: previewToken,
        postId: previewId,
    });

    if (!verified.valid) {
        return NextResponse.json({ success: false, error: 'invalid_preview_token' }, { status: 401 });
    }

    if (verified.slug && !path.includes(`/${verified.slug}`)) {
        return NextResponse.json({ success: false, error: 'preview_path_mismatch' }, { status: 401 });
    }

    // Use getPublicSiteOrigin() instead of request.url to avoid redirecting to localhost behind Nginx proxy
    const redirectUrl = new URL(path, getPublicSiteOrigin(request));
    redirectUrl.searchParams.set('preview_token', previewToken);
    redirectUrl.searchParams.set('preview_id', previewId);

    return NextResponse.redirect(redirectUrl, { status: 307 });
}
