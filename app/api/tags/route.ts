import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import type { Where } from 'payload';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || searchParams.get('per_page') || '50')));
    const slug = searchParams.get('slug') || null;
    const search = searchParams.get('search') || null;
    const orderby = String(searchParams.get('orderby') || 'name');
    const order = String(searchParams.get('order') || 'asc').toLowerCase();

    try {
        const payload = await getPayloadClient();

        const where: Where = {};
        if (slug) where.slug = { equals: slug };
        if (search) where.name = { contains: search };

        const sortField = orderby === 'createdAt' ? 'createdAt' : 'name';
        const sort = order === 'desc' ? `-${sortField}` : sortField;

        const result = await payload.find({
            collection: 'tags',
            where,
            limit,
            page,
            depth: 0,
            sort,
        });

        return NextResponse.json(result, {
            status: 200,
            headers: {
                'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
            },
        });
    } catch (error: any) {
        console.error('[API /api/tags] Error:', error?.message);
        return NextResponse.json({ docs: [], totalDocs: 0, error: error?.message }, { status: 500 });
    }
}
