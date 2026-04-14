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

function toPayloadPostsQuery(searchParams: URLSearchParams) {
    const clean = sanitizePostsParams(searchParams);
    const payloadParams = new URLSearchParams();

    if (clean.has('per_page')) payloadParams.set('limit', clean.get('per_page') || '10');
    if (clean.has('page')) payloadParams.set('page', clean.get('page') || '1');
    if (clean.has('search')) payloadParams.set('where[or][0][title][contains]', clean.get('search') || '');
    if (clean.has('slug')) payloadParams.set('where[slug][equals]', clean.get('slug') || '');
    if (clean.has('categories')) payloadParams.set('where[categories][contains]', clean.get('categories') || '');
    if (clean.has('categories_exclude')) payloadParams.set('where[categories][not_in]', clean.get('categories_exclude') || '');
    if (clean.has('tags')) payloadParams.set('where[tags][contains]', clean.get('tags') || '');
    if (clean.has('exclude')) payloadParams.set('where[id][not_in]', clean.get('exclude') || '');
    return payloadParams.toString();
}

function normalizePayloadPost(post: any) {
    return {
        id: post.id,
        date: post.publishedAt || post.createdAt || new Date().toISOString(),
        slug: post.slug,
        title: { rendered: post.title || '' },
        excerpt: { rendered: post.excerpt || '' },
        content: { rendered: post.content || '' },
        categories: Array.isArray(post.categories)
            ? post.categories.map((category: any) => typeof category === 'object' ? category.id : category).filter(Boolean)
            : [],
        modified: post.updatedAt || post.publishedAt || post.createdAt,
        acf: {
            source_pdf_url: post.sourcePdfUrl || '',
            security_level: post.securityLevel || 'PUBLIC',
            chapitre_comprendre: post.chapitre_comprendre || '',
            lecon_comprendre: post.lecon_comprendre || 0,
        },
        _embedded: {
            'wp:term': [Array.isArray(post.categories)
                ? post.categories
                    .filter((category: any) => category && typeof category === 'object')
                    .map((category: any) => ({ id: category.id, name: category.name, slug: category.slug }))
                : []],
        },
    };
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const qs = sanitizePostsParams(searchParams).toString();
    const cacheKey = qs || '__default__';

    try {
        const provider = getCMSProvider();
        const url = provider === 'payload'
            ? `${getCMSApiBaseUrl()}/posts${qs ? `?${toPayloadPostsQuery(searchParams)}` : ''}`
            : `${getCMSApiBaseUrl()}/posts${qs ? `?${qs}` : ''}`;

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
        const body = provider === 'payload' && res.ok
            ? JSON.stringify((Array.isArray(JSON.parse(text)) ? JSON.parse(text) : JSON.parse(text)?.docs || []).map(normalizePayloadPost))
            : text;

        if (res.ok) {
            responseCache.set(cacheKey, {
                body,
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

        return new NextResponse(body, {
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
