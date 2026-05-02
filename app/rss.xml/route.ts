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

function stripHtml(value: string) {
    return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function GET() {
    try {
        const payload = await getPayloadClient();

        const [postsResult, revelationsResult] = await Promise.all([
            payload.find({
                collection: 'posts',
                where: { _status: { equals: 'published' } },
                limit: 20,
                depth: 1,
                sort: '-publishedAt',
            }),
            payload.find({
                collection: 'revelations',
                where: { _status: { equals: 'published' } },
                limit: 20,
                depth: 1,
                sort: '-createdAt',
            }),
        ]);

        const items = [
            ...((postsResult.docs || []) as any[]).map(doc => ({
                title: String(doc.meta?.title || doc.title || ''),
                url: `https://lassez.fr/${doc.categories?.[0]?.slug || 'article'}/${doc.slug}`,
                description: stripHtml(String(doc.meta?.description || doc.excerpt || '')),
                date: new Date(doc.publishedAt || doc.createdAt).toISOString(),
            })),
            ...((revelationsResult.docs || []) as any[]).map(doc => ({
                title: String(doc.meta?.title || doc.titre || ''),
                url: `https://lassez.fr/revelations/${doc.slug || doc.id}`,
                description: stripHtml(String(doc.meta?.description || doc.contenu_rapide_html || '')),
                date: new Date(doc.publishedAt || doc.createdAt).toISOString(),
            })),
        ].slice(0, 30);

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>l'Assez</title>
    <link>https://lassez.fr</link>
    <description>Flux RSS officiel de l'Assez</description>
    <language>fr-fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.map(item => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <pubDate>${new Date(item.date).toUTCString()}</pubDate>
      <description>${escapeXml(item.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>`;

        return new NextResponse(xml, {
            headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
        });
    } catch (error) {
        console.error('[rss]', error);
        return new NextResponse('Error', { status: 500 });
    }
}
