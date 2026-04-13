import { NextResponse } from 'next/server';
import { WP_API_URL } from '@/lib/api';

export const dynamic = 'force-dynamic';

const ALLOWED_PARAMS = new Set(['per_page', 'page', 'slug', 'search', 'orderby', 'order']);

function sanitizeCategoryParams(searchParams: URLSearchParams) {
    const clean = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
        if (!ALLOWED_PARAMS.has(key)) continue;
        if (!value) continue;
        clean.set(key, value);
    }

    const perPageRaw = Number(clean.get('per_page') || '100');
    const perPage = Number.isFinite(perPageRaw) ? Math.max(1, Math.min(100, perPageRaw)) : 100;
    clean.set('per_page', String(perPage));

    return clean;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const qs = sanitizeCategoryParams(searchParams).toString();
        const url = `${WP_API_URL}/categories${qs ? `?${qs}` : ''}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { next: { revalidate: 900 }, signal: controller.signal });
        clearTimeout(timeout);
        const text = await res.text();

        return new NextResponse(text, {
            status: res.status,
            headers: {
                'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
            },
        });
    } catch {
        return NextResponse.json({ success: false, error: 'wp_categories_unavailable' }, { status: 502 });
    }
}
