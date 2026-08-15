import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const ALLOWED_STATUSES = ['INGESTED', 'RESEARCHED', 'DRAFTED', 'PENDING', 'QUEUED', 'PUBLISHED', 'REJECTED', 'FAILED'];

/** Parse JSON de façon sécurisée : une valeur corrompue ne doit jamais faire crasher la liste. */
function safeJson<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/**
 * Route GET /api/radar
 * 
 * Endpoint principal de récupération des articles du Studio Radar pour l'interface de contrôle.
 * Mappe les onglets UI ('LAB', 'REVIEW', 'QUEUE', 'DONE', 'TRASH') vers les statuts réels
 * de la table Prisma `newsTopic` et renvoie la liste filtrée avec les tags et dates.
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
            status: { in: statuses } 
        };

        if (geo && geo !== 'all') {
            where.geo = geo.toLowerCase();
        }
        if (tag) {
            where.tags = {
                contains: tag
            };
        }

        const topics = await prisma.newsTopic.findMany({
            where,
            include: {
                publications: {
                    select: { scheduledAt: true },
                    orderBy: { scheduledAt: 'asc' },
                    take: 1
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        // Conversion des objets Prisma vers le format attendu par le frontend Studio
        const posts = topics.map(topic => {
            // Parsing sécurisé : une raw_data/final_draft corrompue ne doit pas casser toute la liste
            const draftData: any = safeJson(topic.final_draft, {});
            const rawData: any = safeJson(topic.raw_data, {});

            let tagsArray: string[] = [];
            if (Array.isArray(topic.tags)) {
                tagsArray = topic.tags;
            } else {
                try {
                    const parsed = topic.tags ? JSON.parse(topic.tags) : [];
                    tagsArray = Array.isArray(parsed) ? parsed : [];
                } catch (e) {
                    tagsArray = topic.tags ? topic.tags.split(',') : [];
                }
            }

            const firstScheduled = topic.publications?.[0]?.scheduledAt;

            return {
                id: topic.id,
                source_url: rawData.source_url || '',
                source_title: draftData.headline || rawData.clusterTitle || 'Untitled',
                flash_content: draftData.body || rawData.excerpt || '',
                image_keyword: topic.image_url,
                status: topic.status,
                geo: topic.geo?.toLowerCase(),
                tags: tagsArray.join(', '),
                type_ouverture: topic.taxonomy || 'INFO',
                created_at: topic.createdAt.toISOString(),
                scheduled_at: firstScheduled ? firstScheduled.toISOString() : null,
            };
        });

        // Calcul des tags tendances des 7 derniers jours
        const recentTopics = await prisma.newsTopic.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            },
            select: { tags: true },
            take: 200
        });

        const tagCounts: Record<string, number> = {};
        recentTopics.forEach(t => {
            if (!t.tags) return;
            let tags: string[] = [];
            try {
                tags = JSON.parse(t.tags);
            } catch (e) {
                tags = t.tags.split(',');
            }
            tags.forEach(rawTag => {
                const clean = rawTag.trim().toLowerCase();
                if (clean) {
                    tagCounts[clean] = (tagCounts[clean] || 0) + 1;
                }
            });
        });

        const trendingTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([name, count]) => ({ name, count }));

        return NextResponse.json({
            posts,
            trendingTags
        });
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
 * Met à jour le statut d'un ou plusieurs topics (actions du dashboard Studio).
 * Body accepté :
 *   - { ids: string[], status }       → action groupée (bulk)
 *   - { id, status, flash_content?, image_keyword?, source_title? } → édition ponctuelle
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ids, status, flash_content, image_keyword, source_title } = body;

        const targetIds: string[] = Array.isArray(ids)
            ? ids.map(String).filter(Boolean)
            : (id ? [String(id)] : []);

        if (targetIds.length === 0) {
            return NextResponse.json({ success: false, error: 'id ou ids requis' }, { status: 400 });
        }
        if (!status || !ALLOWED_STATUSES.includes(status)) {
            return NextResponse.json({ success: false, error: `Statut invalide: ${status}` }, { status: 400 });
        }

        const data: any = { status };
        if (status === 'PUBLISHED') {
            data.publishedAt = new Date();
        }

        // Édition ponctuelle : on enrichit final_draft / image_url du topic
        if (targetIds.length === 1 && (flash_content !== undefined || image_keyword !== undefined || source_title !== undefined)) {
            const topic = await prisma.newsTopic.findUnique({ where: { id: targetIds[0] } });
            if (topic) {
                const draftData: any = safeJson(topic.final_draft, {});
                if (source_title !== undefined) draftData.headline = String(source_title);
                if (flash_content !== undefined) draftData.body = String(flash_content);
                data.final_draft = JSON.stringify(draftData);
                if (image_keyword !== undefined) data.image_url = image_keyword || null;
            }
        }

        const result = await prisma.newsTopic.updateMany({
            where: { id: { in: targetIds } },
            data,
        });

        if (result.count === 0) {
            return NextResponse.json({ success: false, error: 'Aucun topic trouvé' }, { status: 404 });
        }

        return NextResponse.json({ success: true, updated: result.count });
    } catch (error: any) {
        console.error('[Radar API PATCH Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/radar
 * Supprime définitivement une liste de topics (et leurs publications liées).
 * Body : { ids: string[] }
 */
export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const ids = Array.isArray(body?.ids) ? body.ids.map(String).filter(Boolean) : [];

        if (ids.length === 0) {
            return NextResponse.json({ success: false, error: 'ids requis' }, { status: 400 });
        }

        // Suppression des publications liées d'abord (contrainte de clé étrangère)
        await prisma.publication.deleteMany({ where: { topicId: { in: ids } } });
        const result = await prisma.newsTopic.deleteMany({ where: { id: { in: ids } } });

        return NextResponse.json({ success: true, deleted: result.count });
    } catch (error: any) {
        console.error('[Radar API DELETE Error]', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
