import { NextResponse } from 'next/server';
import { getContentClient } from '@/lib/provider';
import type { Where } from '@/lib/provider';

export const dynamic = 'force-dynamic';

/**
 * Route API de contenu pour les articles de la collection `posts`.
 * Remplace complètement le proxy WordPress historique.
 * Les clients React (EnquetesClient, HeroCarousel, etc.) consomment
 * directement la structure du provider (titres en string, dates ISO, etc.)
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const page    = Math.max(1, Number(searchParams.get('page') || '1'));
    // Cap à 100 (maxLimit de l'API) : au-delà, l'API tronque silencieusement.
    const limit   = Math.min(100, Math.max(1, Number(searchParams.get('limit') || searchParams.get('per_page') || '10')));
    const slug    = searchParams.get('slug') || null;
    const search  = searchParams.get('search') || null;
    const catId   = searchParams.get('categories') || null;
    const depth   = Number(searchParams.get('depth') || '1');

    try {
        const content = await getContentClient();

        const where: Where = { _status: { equals: 'published' } };

        if (slug)   where.slug       = { equals: slug };
        if (search) where.title      = { contains: search };
        if (catId)  where.categories = { equals: catId };

        const result = await content.find({
            collection: 'posts',
            where,
            limit,
            page,
            depth,
            sort: '-publishedAt',
        });

        return NextResponse.json(result, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=600',
            },
        });
    } catch (error: any) {
        console.error('[API /api/posts] Error:', error?.message);
        return NextResponse.json({ docs: [], totalDocs: 0, error: error?.message }, { status: 500 });
    }
}
