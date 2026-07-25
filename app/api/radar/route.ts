import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
            let draftData: any = {};
            try {
                draftData = topic.final_draft ? JSON.parse(topic.final_draft) : {};
            } catch (e) {
                // En cas d'erreur de parsing JSON, garder un objet vide
            }

            let tagsArray: string[] = [];
            try {
                tagsArray = topic.tags ? JSON.parse(topic.tags) : [];
            } catch (e) {
                tagsArray = topic.tags ? topic.tags.split(',') : [];
            }

            const firstScheduled = topic.publications?.[0]?.scheduledAt;

            return {
                id: topic.id,
                source_url: topic.raw_data ? JSON.parse(topic.raw_data).source_url : '',
                source_title: draftData.headline || (topic.raw_data ? JSON.parse(topic.raw_data).clusterTitle : 'Untitled'),
                flash_content: draftData.body || (topic.raw_data ? JSON.parse(topic.raw_data).excerpt : ''),
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
