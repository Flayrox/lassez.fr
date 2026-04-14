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

function sanitizeTagParams(searchParams: URLSearchParams) {
    const clean = new URLSearchParams();
    for (const [key, value] of searchParams.entries()) {
        if (!ALLOWED_PARAMS.has(key)) continue;
        if (!value) continue;
        clean.set(key, value);
    }

    const perPageRaw = Number(clean.get('per_page') || '30');
    const perPage = Number.isFinite(perPageRaw) ? Math.max(1, Math.min(50, perPageRaw)) : 30;
    clean.set('per_page', String(perPage));

    return clean;
}

function toPayloadTagsQuery(searchParams: URLSearchParams) {
    const clean = sanitizeTagParams(searchParams);
    const payloadParams = new URLSearchParams();
    if (clean.has('per_page')) payloadParams.set('limit', clean.get('per_page') || '30');
    if (clean.has('page')) payloadParams.set('page', clean.get('page') || '1');
    if (clean.has('slug')) payloadParams.set('where[slug][equals]', clean.get('slug') || '');
    if (clean.has('search')) payloadParams.set('where[or][0][name][contains]', clean.get('search') || '');
    if (clean.has('orderby')) payloadParams.set('sort', clean.get('orderby') || 'count');
    if (clean.has('order') && (clean.get('order') || '').toLowerCase() === 'desc') payloadParams.set('sort', '-count');
    return payloadParams.toString();
}

function normalizePayloadTag(tag: any) {
    return {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        count: tag.count || 0,
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const qs = sanitizeTagParams(searchParams).toString();
    const cacheKey = qs || '__default__';

    try {
        const provider = getCMSProvider();
        const url = provider === 'payload'
            ? `${getCMSApiBaseUrl()}/tags${qs ? `?${toPayloadTagsQuery(searchParams)}` : ''}`
            : `${getCMSApiBaseUrl()}/tags${qs ? `?${qs}` : ''}`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { next: { revalidate: 900 }, signal: controller.signal });
        clearTimeout(timeout);
        const text = await res.text();
        const body = provider === 'payload' && res.ok
            ? JSON.stringify((Array.isArray(JSON.parse(text)) ? JSON.parse(text) : JSON.parse(text)?.docs || []).map(normalizePayloadTag))
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
        return NextResponse.json({ success: false, error: 'wp_tags_unavailable' }, { status: 502 });
    }
}
