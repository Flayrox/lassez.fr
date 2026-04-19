import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import type { Where } from 'payload';

export const dynamic = 'force-dynamic';

/**
 * GET /api/revelations
 * Paramètres :
 *   - per_page / limit  : nb de résultats (max 50, défaut 20)
 *   - page              : pagination (défaut 1)
 *   - zone_geo          : 'france' | 'international' (filtre géographique)
 *   - tag               : slug d'un tag (filtre thématique)
 *   - search            : texte libre sur le titre
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const page    = Math.max(1, Number(searchParams.get('page')     || '1'));
    const limit   = Math.min(50, Math.max(1, Number(searchParams.get('per_page') || searchParams.get('limit') || '20')));
    const zoneGeo = searchParams.get('zone_geo') || null;
    const tagSlug = searchParams.get('tag')      || null;
    const search  = searchParams.get('search')   || null;

    try {
        const payload = await getPayloadClient();
        const where: Where = { _status: { equals: 'published' } };

        if (zoneGeo) where.zone_geo = { equals: zoneGeo };

        if (tagSlug) {
            // Résolution du slug tag → id
            const tagRes = await payload.find({
                collection: 'tags',
                where: { slug: { equals: tagSlug } },
                limit: 1,
            });
            if (tagRes.docs.length > 0) {
                where.tags = { equals: tagRes.docs[0].id };
            }
        }

        if (search) where.titre = { contains: search };

        const result = await payload.find({
            collection: 'revelations',
            where,
            limit,
            page,
            depth: 1,   // depth 1 pour avoir les objets tag expandés
            sort: '-createdAt',
        });

        return NextResponse.json(result, {
            status: 200,
            headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' },
        });
    } catch (error: any) {
        console.error('[API /api/revelations] Error:', error?.message);
        return NextResponse.json({ docs: [], totalDocs: 0, hasNextPage: false, error: error?.message }, { status: 500 });
    }
}
