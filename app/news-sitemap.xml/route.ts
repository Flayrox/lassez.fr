import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';

export const dynamic = 'force-dynamic';

/**
 * Échappe les caractères spéciaux XML pour prévenir toute corruption du sitemap
 */
function escapeXml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Reconstruit l'URL publique canonique d'un article
 */
function buildPostUrl(doc: any) {
    if (doc?.slug) {
        const cat = (doc.categories && typeof doc.categories[0] === 'object') ? doc.categories[0].slug : 'article';
        return `https://lassez.fr/${cat}/${doc.slug}`;
    }
    return `https://lassez.fr/revelations/${doc?.id}`;
}

/**
 * Route Dynamic Google News Sitemap XML (/news-sitemap.xml)
 * 
 * Cette route génère en temps réel un flux XML conforme au protocole officiel Google News.
 * Google News exige que seuls les articles publiés au cours des 48 dernières heures soient listés.
 */
export async function GET() {
    try {
        const payload = await getPayloadClient();
        
        // Fenêtre temporelle stricte de 48 heures conformément aux directives Google News
        const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const [postsResult, revelationsResult] = await Promise.all([
            payload.find({
                collection: 'posts',
                where: {
                    and: [
                        { _status: { equals: 'published' } },
                        { publishedAt: { greater_than_equal: cutoff.toISOString() } },
                    ],
                },
                limit: 100,
                depth: 2,
                sort: '-publishedAt',
            }),
            payload.find({
                collection: 'revelations',
                where: {
                    and: [
                        { _status: { equals: 'published' } },
                        { createdAt: { greater_than_equal: cutoff.toISOString() } },
                    ],
                },
                limit: 100,
                depth: 2,
                sort: '-createdAt',
            }),
        ]);

        const entries = [
            ...((postsResult.docs || []) as any[]).map(doc => {
                const cats = (doc.categories || []).map((c: any) => typeof c === 'object' ? c.name : '').filter(Boolean);
                const tags = (doc.tags || []).map((t: any) => typeof t === 'object' ? t.name : '').filter(Boolean);
                const kws = [...cats, ...tags].join(', ');

                return {
                    url: buildPostUrl(doc),
                    title: escapeXml(String(doc.seoTitle || doc.meta?.title || doc.title || '')),
                    publishedAt: new Date(doc.publishedAt || doc.createdAt).toISOString(),
                    keywords: escapeXml(kws || String(doc.seoDescription || doc.excerpt || 'l\'Assez')),
                };
            }),
            ...((revelationsResult.docs || []) as any[]).map(doc => ({
                url: `https://lassez.fr/revelations/${doc.slug || doc.id}`,
                title: escapeXml(String(doc.meta?.title || doc.titre || '')),
                publishedAt: new Date(doc.createdAt).toISOString(),
                keywords: 'Révélations, Investigation, l\'Assez',
            })),
        ].slice(0, 1000);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${entries.map(entry => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${entry.publishedAt}</lastmod>
    <news:news>
      <news:publication>
        <news:name>l'Assez</news:name>
        <news:language>fr</news:language>
      </news:publication>
      <news:publication_date>${entry.publishedAt}</news:publication_date>
      <news:title>${entry.title}</news:title>
      <news:keywords>${entry.keywords || 'l\'Assez'}</news:keywords>
    </news:news>
  </url>`).join('\n')}
</urlset>`;

        return new NextResponse(xml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=300, s-maxage=600',
            },
        });
    } catch (error) {
        console.error('[news-sitemap]', error);
        return new NextResponse('Error generating Google News sitemap', { status: 500 });
    }
}
