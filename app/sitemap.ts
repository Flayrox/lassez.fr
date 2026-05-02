import { MetadataRoute } from 'next';
import { getPayloadClient } from '@/lib/payload';
import { formatCommuneSlug } from '../lib/seo-engine';
import { parseJsonArray } from '../lib/elections';
import type { Post, Category, Lesson, Revelation } from '@/payload-types';

const BASE_URL = 'https://lassez.fr';

function toDate(value: unknown) {
    const date = value ? new Date(String(value)) : new Date();
    return Number.isNaN(date.getTime()) ? new Date() : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    try {
        const payload = await getPayloadClient();

        const [postsResult, lessonsResult, revelationsResult, categoriesResult] = await Promise.all([
            payload.find({
                collection: 'posts',
                where: { _status: { equals: 'published' } },
                limit: 200,
                page: 1,
                depth: 1,
                sort: '-publishedAt',
            }),
            payload.find({
                collection: 'lessons',
                where: { _status: { equals: 'published' } },
                limit: 200,
                page: 1,
                depth: 1,
                sort: '-createdAt',
            }),
            payload.find({
                collection: 'revelations',
                where: { _status: { equals: 'published' } },
                limit: 200,
                page: 1,
                depth: 1,
                sort: '-createdAt',
            }),
            payload.find({
                collection: 'categories',
                limit: 100,
                page: 1,
                depth: 0,
                sort: 'name',
            }),
        ]);

        const posts = postsResult.docs as Post[];
        const lessons = lessonsResult.docs as Lesson[];
        const revelations = revelationsResult.docs as Revelation[];
        const categories = categoriesResult.docs as Category[];

        const postUrls = Array.isArray(posts) ? posts.map((post: Post) => {
            const firstCategory = Array.isArray(post.categories) ? post.categories[0] : null;
            const primaryCat = firstCategory && typeof firstCategory === 'object' ? firstCategory : null;
            const catSlug = primaryCat?.slug || 'article';

            return {
                url: `${BASE_URL}/${catSlug}/${post.slug}`,
                lastModified: toDate(post.updatedAt || post.publishedAt || post.createdAt),
                changeFrequency: 'weekly' as const,
                priority: catSlug === 'revelations' ? 0.9 : 0.8,
            };
        }) : [];

        const lessonUrls = Array.isArray(lessons) ? lessons.map((lesson: Lesson) => ({
            url: `${BASE_URL}/comprendre/${lesson.slug}`,
            lastModified: toDate(lesson.updatedAt || lesson.createdAt),
            changeFrequency: 'weekly' as const,
            priority: 0.75,
        })) : [];

        const revelationUrls = Array.isArray(revelations) ? revelations.map((rev: Revelation) => ({
            url: `${BASE_URL}/revelations/${(rev as any).slug || rev.id}`,
            lastModified: toDate(rev.updatedAt || rev.createdAt),
            changeFrequency: 'daily' as const,
            priority: 0.9,
        })) : [];

        const categoryUrls = Array.isArray(categories) ? categories.map((cat: Category) => ({
            url: `${BASE_URL}/enquetes?secteur=${cat.slug}`,
            lastModified: toDate(cat.updatedAt || cat.createdAt),
            changeFrequency: 'weekly' as const,
            priority: 0.6,
        })) : [];

        const staticRoutes = [
            { path: '', priority: 1.0, changeFrequency: 'daily' as const },
            { path: '/enquetes', priority: 0.95, changeFrequency: 'daily' as const },
            { path: '/revelations', priority: 0.95, changeFrequency: 'daily' as const },
            { path: '/investigation', priority: 0.9, changeFrequency: 'weekly' as const },
            { path: '/comprendre', priority: 0.9, changeFrequency: 'weekly' as const },
            { path: '/podcasts', priority: 0.75, changeFrequency: 'weekly' as const },
            { path: '/elections', priority: 1.0, changeFrequency: 'daily' as const },
            { path: '/soutenir', priority: 0.6, changeFrequency: 'monthly' as const },
            { path: '/a-propos', priority: 0.5, changeFrequency: 'monthly' as const },
            { path: '/mentions-legales', priority: 0.2, changeFrequency: 'yearly' as const },
            { path: '/search', priority: 0.1, changeFrequency: 'monthly' as const },
        ].map(({ path, priority, changeFrequency }) => ({
            url: `${BASE_URL}${path}`,
            lastModified: new Date(),
            changeFrequency,
            priority,
        }));

        let electionUrls: any[] = [];
        try {
            const path = await import('path');
            const Database = (await import('better-sqlite3')).default;
            const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
            const db = new Database(dbPath);

            const hasRadarSettingsTable = db
                .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'radar_settings'")
                .get();

            if (hasRadarSettingsTable) {
                const settingsRows = db.prepare(`
                    SELECT key, value FROM radar_settings
                    WHERE key IN ('election_front_display_slugs_json', 'election_analysis_target_slug')
                `).all() as { key: string; value: string }[];
                const settingsMap = Object.fromEntries(settingsRows.map(r => [String(r.key), String(r.value || '')]));
                const displaySlugs = parseJsonArray(settingsMap.election_front_display_slugs_json, ['municipales-2026']);
                const targetSlug = String(settingsMap.election_analysis_target_slug || 'municipales-2026');

                const slugRootUrls = displaySlugs.map((slug) => ({
                    url: `${BASE_URL}/elections/${slug}`,
                    lastModified: new Date(),
                    changeFrequency: 'daily' as const,
                    priority: slug === targetSlug ? 1.0 : 0.95,
                }));

                const dynamicUrls: Array<{ url: string; lastModified: Date; changeFrequency: 'daily' | 'weekly'; priority: number }> = [];

                for (const slug of displaySlugs) {
                    const departments = db.prepare(`
                        SELECT DISTINCT code_departement FROM elections_officiel_cache 
                        WHERE election_slug = ? AND code_departement IS NOT NULL
                    `).all(slug) as { code_departement: string }[];

                    for (const d of departments) {
                        dynamicUrls.push({
                            url: `${BASE_URL}/elections/${slug}/departement/${d.code_departement}`,
                            lastModified: new Date(),
                            changeFrequency: 'daily',
                            priority: 0.9,
                        });
                    }

                    const cities = db.prepare(`
                        SELECT DISTINCT code_insee, ville, updated_at FROM elections_officiel_cache 
                        WHERE election_slug = ?
                    `).all(slug) as { code_insee: string; ville: string; updated_at: string }[];

                    for (const c of cities) {
                        dynamicUrls.push({
                            url: `${BASE_URL}/elections/${slug}/commune/${formatCommuneSlug(c.code_insee, c.ville)}`,
                            lastModified: new Date(c.updated_at || new Date()),
                            changeFrequency: 'weekly',
                            priority: 0.8,
                        });
                    }
                }

                electionUrls = [...slugRootUrls, ...dynamicUrls];
            }
            db.close();
        } catch (dbErr) {
            console.warn('Sitemap DB enrichment skipped:', dbErr instanceof Error ? dbErr.message : String(dbErr));
        }

        return [...staticRoutes, ...postUrls, ...lessonUrls, ...revelationUrls, ...categoryUrls, ...electionUrls];
    } catch (e) {
        console.error('Failed to generate sitemap', e);
        return [{ url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 }];
    }
}