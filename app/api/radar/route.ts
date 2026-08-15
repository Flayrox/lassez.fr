import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_STATUSES = ['INGESTED', 'RESEARCHED', 'DRAFTED', 'VALIDATED', 'PENDING', 'QUEUED', 'PUBLISHED', 'REJECTED', 'REJECTED_ERROR', 'FAILED'];

/**
 * Route /api/radar
 *
 * Endpoint principal de récupération des signals du Studio Radar pour l'interface
 * de contrôle. Mappe les onglets UI ('LAB', 'REVIEW', 'QUEUE', 'DONE', 'TRASH')
 * vers les statuts réels de la collection Payload `signals`.
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const statusParam = searchParams.get('status') || 'PENDING';
        const geo = searchParams.get('geo');
        const tag = searchParams.get('tag');

        // Correspondance entre les onglets de l'interface Studio et les statuts de la base
        let statuses: string[] = [statusParam];
        if (statusParam === 'LAB') {
            statuses = ['INGESTED', 'RESEARCHED', 'DRAFTED'];
        } else if (statusParam === 'REVIEW') {
            statuses = ['PENDING'];
        } else if (statusParam === 'QUEUE') {
            statuses = ['QUEUED'];
        } else if (statusParam === 'DONE') {
            statuses = ['PUBLISHED'];
        } else if (statusParam === 'TRASH') {
            statuses = ['REJECTED', 'FAILED'];
        }

        const where: any = {
            status: { in: statuses },
        };

        if (geo && geo !== 'all') {
            where.geo = { equals: geo.toLowerCase() };
        }

        const payload = await getPayloadClient();
        const result = await payload.find({
            collection: 'signals',
            where,
            limit: 100,
            depth: 1,
            sort: '-createdAt',
        });

        // Conversion des docs Payload vers le format attendu par le frontend Studio
        const posts = result.docs.map((topic: any) => {
            const rawData = topic.raw_data || {};
            const draftData = topic.final_draft || {};

            let tagsArray: string[] = [];
            if (Array.isArray(topic.tags)) {
                tagsArray = topic.tags.map(String);
            } else if (typeof topic.tags === 'string') {
                try { tagsArray = JSON.parse(topic.tags); } catch { tagsArray = topic.tags.split(','); }
            }

            const pubs = topic.publications || [];
            const firstScheduled = pubs[0]?.scheduled_at || null;

            return {
                id: topic.id,
                source_url: rawData.source_url || '',
                source_title: draftData.headline || rawData.clusterTitle || topic.source_title || 'Untitled',
                flash_content: draftData.body || rawData.excerpt || '',
                image_keyword: topic.image_url,
                status: topic.status,
                geo: (topic.geo || '').toLowerCase(),
                tags: tagsArray.join(', '),
                type_ouverture: topic.taxonomy || 'INFO',
                created_at: topic.createdAt,
                scheduled_at: firstScheduled,
            };
        });

        // Calcul des tags tendances des 7 derniers jours
        const recent = await payload.find({
            collection: 'signals',
            where: {
                createdAt: { greater_than: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() },
            },
            limit: 200,
            depth: 0,
        });

        const tagCounts: Record<string, number> = {};
        recent.docs.forEach((t: any) => {
            let tags: string[] = Array.isArray(t.tags) ? t.tags.map(String) : [];
            if (typeof t.tags === 'string') {
                try { tags = JSON.parse(t.tags); } catch { tags = t.tags.split(','); }
            }
            tags.forEach((rawTag) => {
                const clean = String(rawTag).trim().toLowerCase();
                if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
            });
        });

        const trendingTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        return NextResponse.json({ posts, trendingTags });
    } catch (error: any) {
        console.error('[Radar API Error]', error);
        return NextResponse.json(
            { error: 'Erreur lors de la récupération des données Radar', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/radar
 * Met à jour le statut d'un ou plusieurs signals (actions du dashboard Studio).
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ids, status, flash_content, image_keyword, source_title } = body;

        const targetIds: any[] = Array.isArray(ids)
            ? ids.map(String).filter(Boolean)
            : (id ? [String(id)] : []);

        if (targetIds.length === 0) {
            return NextResponse.json({ success: false, error: 'id ou ids requis' }, { status: 400 });
        }
        if (!status || !ALLOWED_STATUSES.includes(status)) {
            return NextResponse.json({ success: false, error: `Statut invalide: ${status}` }, { status: 400 });
        }

        const payload = await getPayloadClient();

        // Édition ponctuelle : on enrichit final_draft / image_url / source_title
        if (targetIds.length === 1 && (flash_content !== undefined || image_keyword !== undefined || source_title !== undefined)) {
            const topic = await payload.findByID({ collection: 'signals', id: targetIds[0], depth: 0 }).catch(() => null);
            if (topic) {
                const draftData = topic.final_draft && typeof topic.final_draft === 'object' ? { ...topic.final_draft } : {};
                const updateData: any = { status };
                if (source_title !== undefined) updateData.source_title = String(source_title);
                if (flash_content !== undefined) draftData.body = String(flash_content);
                if (source_title !== undefined) draftData.headline = String(source_title);
                updateData.final_draft = draftData;
                if (image_keyword !== undefined) updateData.image_url = image_keyword || null;
                if (status === 'PUBLISHED') updateData.published_at = new Date().toISOString();

                await payload.update({ collection: 'signals', id: targetIds[0], data: updateData });
                return NextResponse.json({ success: true, updated: 1 });
            }
        }

        // Bulk : changement de statut simple
        const data: any = { status };
        if (status === 'PUBLISHED') data.published_at = new Date().toISOString();

        let updated = 0;
        for (const id of targetIds) {
            try {
                await payload.update({ collection: 'signals', id, data });
                updated++;
            } catch (e: any) {
                console.error(`[Radar PATCH] échec signal ${id}:`, e.message);
            }
        }

        if (updated === 0) {
            return NextResponse.json({ success: false, error: 'Aucun signal trouvé' }, { status: 404 });
        }

        return NextResponse.json({ success: true, updated });
    } catch (error: any) {
        console.error('[Radar API PATCH Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/radar
 * Supprime définitivement une liste de signals (et leurs publications liées).
 */
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];

        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'ids requis' }, { status: 400 });
        }

        const payload = await getPayloadClient();

        // Supprimer les publications liées d'abord (relation signal → publications)
        const pubs = await payload.find({
            collection: 'publications',
            where: { signal: { in: ids } },
            limit: 500,
            depth: 0,
        });
        for (const pub of pubs.docs) {
            await payload.delete({ collection: 'publications', id: pub.id }).catch(() => {});
        }

        let deleted = 0;
        for (const id of ids) {
            try {
                await payload.delete({ collection: 'signals', id });
                deleted++;
            } catch (e: any) {
                console.error(`[Radar DELETE] échec signal ${id}:`, e.message);
            }
        }

        return NextResponse.json({ success: true, deleted });
    } catch (error: any) {
        console.error('[Radar API DELETE Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
