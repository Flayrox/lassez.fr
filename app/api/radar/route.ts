import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const statusParam = searchParams.get('status') || 'PENDING';
        const geo = searchParams.get('geo'); 
        const tag = searchParams.get('tag');

        // Mapping des onglets UI vers les statuts Prisma réels
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

        // Build where clause
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

        // Map Prisma topics to the format expected by the frontend
        const posts = topics.map(topic => {
            let draftData: any = {};
            try {
                draftData = topic.final_draft ? JSON.parse(topic.final_draft) : {};
            } catch (e) {
                // Fallback
            }

            let tagsArray: string[] = [];
            try {
                tagsArray = topic.tags ? JSON.parse(topic.tags) : [];
            } catch (e) {
                tagsArray = topic.tags ? topic.tags.split(',') : [];
            }

            // On récupère la date de la première publication prévue
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

        // Trending tags (last 7 days)
        const recentTopics = await prisma.newsTopic.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                }
            },
            select: { tags: true },
            take: 200
        });

        const tagCount: Record<string, number> = {};
        recentTopics.forEach(t => {
            try {
                const tags = JSON.parse(t.tags || '[]');
                tags.forEach((tag: string) => {
                    const cleaned = tag.trim();
                    if (cleaned) tagCount[cleaned] = (tagCount[cleaned] || 0) + 1;
                });
            } catch (e) {}
        });

        const trendingTags = Object.entries(tagCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 12)
            .map(([tag, count]) => ({ tag, count }));

        return NextResponse.json({ 
            success: true, 
            count: posts.length, 
            posts, 
            trending_tags: trendingTags 
        });
    } catch (error: any) {
        console.error("Erreur API Radar (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ids, status, flash_content, image_keyword, source_title } = body;

        const idsArray = ids || (id ? [id] : []);
        if (idsArray.length === 0 || !status) {
            return NextResponse.json({ success: false, error: 'ID(s) et Status requis' }, { status: 400 });
        }

        const validStatuses = ['APPROVED', 'REJECTED', 'PENDING', 'PUBLISHED', 'INGESTED', 'RESEARCHED', 'DRAFTED', 'QUEUED'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ success: false, error: 'Status invalide' }, { status: 400 });
        }

        for (const topicId of idsArray) {
            const currentTopic = await prisma.newsTopic.findUnique({ where: { id: topicId } });
            if (!currentTopic) continue;

            let finalDraft = currentTopic.final_draft ? JSON.parse(currentTopic.final_draft) : {};
            
            // Update draft fields if provided
            if (flash_content !== undefined) finalDraft.body = flash_content;
            if (source_title !== undefined) finalDraft.headline = source_title;

            const updateData: any = {
                status: status,
                final_draft: JSON.stringify(finalDraft)
            };

            if (image_keyword !== undefined) {
                updateData.image_url = image_keyword;
            }

            // --- LOGIQUE SPÉCIFIQUE V3 ---
            
            // Si on passe en QUEUED (Approbation Manuelle)
            if (status === 'QUEUED' && currentTopic.status !== 'QUEUED') {
                const settings = await prisma.globalSettings.findFirst();
                if (settings) {
                    const platforms = [];
                    if (settings.enableDiscord) platforms.push('DISCORD');
                    if (settings.enableX) platforms.push('X');
                    if (settings.enableBluesky) platforms.push('BLUESKY');
                    if (settings.enableMastodon) platforms.push('MASTODON');
                    if (settings.enablePayloadCMS) platforms.push('PAYLOAD');

                    // On crée les publications au statut PENDING pour Node 6
                    for (const plat of platforms) {
                        // On vérifie si elle n'existe pas déjà
                        const exists = await prisma.publication.findFirst({
                            where: { topicId, platform: plat }
                        });
                        if (!exists) {
                            await prisma.publication.create({
                                data: {
                                    topicId,
                                    platform: plat,
                                    status: 'PENDING',
                                    scheduledAt: new Date() // Immédiat ou selon délai, ici on met maintenant pour que Node 6 le prenne
                                }
                            });
                        }
                    }
                }
            }

            await prisma.newsTopic.update({
                where: { id: topicId },
                data: updateData
            });

            // Si passage en PUBLISHED (Publish Now manuel depuis la queue)
            if (status === 'PUBLISHED') {
                const scriptPath = path.join(process.cwd(), 'radar_lassez', 'run_publisher_now.ts');
                const publishProcess = spawn('npx', ['tsx', scriptPath], {
                    detached: true,
                    stdio: 'ignore',
                    cwd: process.cwd()
                });
                publishProcess.unref();
            }
        }

        return NextResponse.json({ success: true, message: `Statut modifié pour ${status}` });
    } catch (error: any) {
        console.error("Erreur API Radar (PATCH):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
