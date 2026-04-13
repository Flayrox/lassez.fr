import { MetadataRoute } from 'next';
import { getServerWpApiBaseUrl } from '../lib/wp-server-base';
import { formatCommuneSlug } from '../lib/seo-engine';
import { parseJsonArray } from '../lib/elections';

const BASE_URL = 'https://lassez.fr';
const WP_BASE = getServerWpApiBaseUrl();

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    try {
        // Fetch posts avec embed pour récupérer les slugs de catégories
        const postsRes = await fetch(`${WP_BASE}/posts?per_page=100&_embed`, { next: { revalidate: 3600 } });
        const posts = await postsRes.json();

        // Fetch categories
        const categoriesRes = await fetch(`${WP_BASE}/categories?per_page=100`, { next: { revalidate: 3600 } });
        const categories = await categoriesRes.json();

        // URLs articles en silo /[categorie]/[slug]
        const postUrls = Array.isArray(posts) ? posts.map((post: any) => {
            const primaryCat = post._embedded?.['wp:term']?.[0]?.[0];
            const catSlug = primaryCat?.slug || 'article';
            if (catSlug === 'revelations') {
                return {
                    url: `${BASE_URL}/revelations`,
                    lastModified: new Date(post.modified || post.date),
                    changeFrequency: 'daily' as const,
                    priority: 0.8,
                };
            }
            return {
                url: `${BASE_URL}/${catSlug}/${post.slug}`,
                lastModified: new Date(post.modified || post.date),
                changeFrequency: 'weekly' as const,
                priority: 0.8,
            };
        }) : [];

        const categoryUrls = Array.isArray(categories) ? categories.map((cat: any) => ({
            url: `${BASE_URL}/category/${cat.slug}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.7,
        })) : [];

        const staticRoutes = [
            { path: '', priority: 1.0 },
            { path: '/enquetes', priority: 0.9 },
            { path: '/revelations', priority: 0.9 },
            { path: '/investigation', priority: 0.9 },
            { path: '/comprendre', priority: 0.9 },
            { path: '/podcasts', priority: 0.7 },
            { path: '/elections', priority: 1.0 },
            { path: '/soutenir', priority: 0.6 },
            { path: '/a-propos', priority: 0.5 },
            { path: '/mentions-legales', priority: 0.3 },
        ].map(({ path, priority }) => ({
            url: `${BASE_URL}${path}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority,
        }));

        // Ajout des silos électoraux (dynamique depuis SQLite)
        let electionUrls: any[] = [];
        try {
            const path = await import('path');
            const Database = (await import('better-sqlite3')).default;
            const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
            const db = new Database(dbPath);
            
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
            db.close();
        } catch (dbErr) {
            console.error('Sitemap DB fetch error:', dbErr);
        }

        return [...staticRoutes, ...categoryUrls, ...postUrls, ...electionUrls];
    } catch (e) {
        console.error('Failed to generate sitemap', e);
        return [{ url: BASE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1 }];
    }
}