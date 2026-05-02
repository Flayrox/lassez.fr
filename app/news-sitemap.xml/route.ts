import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';

export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function buildPostUrl(doc: any) {
    if (doc?.slug) return `https://lassez.fr/revelations/${doc.slug}`;
    if (doc?.categories?.[0]?.slug) return `https://lassez.fr/${doc.categories[0].slug}/${doc.slug || doc.id}`;
    return `https://lassez.fr/revelations/${doc?.id}`;
}

export async function GET() {
    try {
        const payload = await getPayloadClient();
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
                depth: 2, // depth 2 for tags and categories
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
                    title: escapeXml(String(doc.meta?.title || doc.title || '')),
                    publishedAt: new Date(doc.publishedAt || doc.createdAt).toISOString(),
                    keywords: escapeXml(kws || String(doc.meta?.description || doc.excerpt || 'l\'Assez')),
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
            headers: { 'Content-Type': 'application/xml; charset=utf-8' },
        });
    } catch (error) {
        console.error('[news-sitemap]', error);
        return new NextResponse('Error', { status: 500 });
    }
}
