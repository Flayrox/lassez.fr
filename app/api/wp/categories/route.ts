import { NextResponse } from 'next/server';
import { getCMSApiBaseUrl } from '@/lib/api';
import { getCMSProvider } from '@/lib/cms-provider';

export const dynamic = 'force-dynamic';

type CachedPayload = {
    body: string;
    contentType: string;
    expiresAt: number;
};

const responseCache = new Map<string, CachedPayload>();

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

function toPayloadCategoriesQuery(searchParams: URLSearchParams) {
    const clean = sanitizeCategoryParams(searchParams);
    const payloadParams = new URLSearchParams();
    if (clean.has('per_page')) payloadParams.set('limit', clean.get('per_page') || '100');
    if (clean.has('page')) payloadParams.set('page', clean.get('page') || '1');
    if (clean.has('slug')) payloadParams.set('where[slug][equals]', clean.get('slug') || '');
    if (clean.has('search')) payloadParams.set('where[or][0][name][contains]', clean.get('search') || '');
    if (clean.has('orderby')) payloadParams.set('sort', clean.get('orderby') || 'sortOrder');
    if (clean.has('order') && (clean.get('order') || '').toLowerCase() === 'desc') payloadParams.set('sort', '-sortOrder');
    return payloadParams.toString();
}

function normalizePayloadCategory(category: any) {
    return {
        id: category.id,
        name: category.name,
        slug: category.slug,
        count: category.count || 0,
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const qs = sanitizeCategoryParams(searchParams).toString();
    const cacheKey = qs || '__default__';

    try {
        const provider = getCMSProvider();
        const url = provider === 'payload'
            ? `${getCMSApiBaseUrl()}/categories${qs ? `?${toPayloadCategoriesQuery(searchParams)}` : ''}`
            : `${getCMSApiBaseUrl()}/categories${qs ? `?${qs}` : ''}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
            next: {
                revalidate: 900,
                tags: ['wp-categories']
            },
            signal: controller.signal
        });
        clearTimeout(timeout);
        const text = await res.text();
        const body = provider === 'payload' && res.ok
            ? JSON.stringify((Array.isArray(JSON.parse(text)) ? JSON.parse(text) : JSON.parse(text)?.docs || []).map(normalizePayloadCategory))
            : text;

        if (res.ok) {
            responseCache.set(cacheKey, {
                body,
                contentType: res.headers.get('content-type') || 'application/json; charset=utf-8',
                expiresAt: Date.now() + 30 * 60 * 1000,
            });
        } else {
            const cached = responseCache.get(cacheKey);
            if (cached && cached.expiresAt > Date.now()) {
                return new NextResponse(cached.body, {
                    status: 200,
                    headers: {
                        'Content-Type': cached.contentType,
                        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
                        'X-Proxy-Stale': '1',
                    },
                });
            }
        }

        return new NextResponse(body, {
            status: res.status,
            headers: {
                'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
            },
        });
    } catch {
        const cached = responseCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return new NextResponse(cached.body, {
                status: 200,
                headers: {
                    'Content-Type': cached.contentType,
                    'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600',
                    'X-Proxy-Stale': '1',
                },
            });
        }
        return NextResponse.json({ success: false, error: 'wp_categories_unavailable' }, { status: 502 });
    }
}
