import { NextResponse } from 'next/server';
import { WP_API_URL } from '@/lib/api';

export const dynamic = 'force-dynamic';

type CachedPayload = {
    body: string;
    contentType: string;
    expiresAt: number;
};

const responseCache = new Map<string, CachedPayload>();

const ALLOWED_PARAMS = new Set([
    'per_page',
    'page',
    '_embed',
    'categories',
    'categories_exclude',
    'tags',
    'search',
    'slug',
    'exclude',
    'orderby',
    'order',
]);

function sanitizePostsParams(searchParams: URLSearchParams) {
    const clean = new URLSearchParams();
    const wantsEmbed = searchParams.has('_embed');

    for (const [key, value] of searchParams.entries()) {
        if (!ALLOWED_PARAMS.has(key)) continue;
        if (key === '_embed') continue;
        if (!value) continue;
        clean.set(key, value);
    }

    if (wantsEmbed) {
        clean.set('_embed', '1');
    }

    const perPageRaw = Number(clean.get('per_page') || '10');
    const perPage = Number.isFinite(perPageRaw) ? Math.max(1, Math.min(20, perPageRaw)) : 10;
    clean.set('per_page', String(perPage));

    if (clean.has('page')) {
        const pageRaw = Number(clean.get('page') || '1');
        const page = Number.isFinite(pageRaw) ? Math.max(1, Math.min(50, pageRaw)) : 1;
        clean.set('page', String(page));
    }

    if (clean.has('search')) {
        clean.set('search', String(clean.get('search') || '').slice(0, 100));
    }

    return clean;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const qs = sanitizePostsParams(searchParams).toString();
    const cacheKey = qs || '__default__';

    try {
        const url = `${WP_API_URL}/posts${qs ? `?${qs}` : ''}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
            next: {
                revalidate: 300,
                tags: ['wp-posts']
            },
            signal: controller.signal
        });
        clearTimeout(timeout);
        const text = await res.text();

        if (res.ok) {
            responseCache.set(cacheKey, {
                body: text,
                contentType: res.headers.get('content-type') || 'application/json; charset=utf-8',
                expiresAt: Date.now() + 10 * 60 * 1000,
            });
        } else {
            const cached = responseCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return new NextResponse(cached.body, {
                    status: 200,
                    headers: {
                        'Content-Type': cached.contentType,
                        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=1200',
                        'X-Proxy-Stale': '1',
                    },
                });
            }
        }

        return new NextResponse(text, {
            status: res.status,
            headers: {
                'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
            },
        });
    } catch {
        const cached = responseCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return new NextResponse(cached.body, {
                status: 200,
                headers: {
                    'Content-Type': cached.contentType,
                    'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=1200',
                    'X-Proxy-Stale': '1',
                },
            });
        }
        return NextResponse.json({ success: false, error: 'wp_posts_unavailable' }, { status: 502 });
    }
}
