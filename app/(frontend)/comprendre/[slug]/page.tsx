import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { getPayloadClient } from '@/lib/payload';
import { getApiOrigin, getPublicSiteOrigin } from '@/lib/host-urls';
import { getPreviewContext } from '@/lib/wp-preview';
import { WPPost } from '@/types';
import ComprendreLessonClient from '@/components/ComprendreLessonClient';
import PreviewShell from '@/components/PreviewShell';

type Props = {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getPost(slug: string, previewContext: any): Promise<WPPost | null> {
    const payload = await getPayloadClient();
    const res = await payload.find({
        collection: 'lessons',
        where: { slug: { equals: slug } },
        limit: 1,
        draft: !!previewContext,
        overrideAccess: !!previewContext,
    });
    
    if (!res.docs || res.docs.length === 0) return null;
    const doc = res.docs[0];

    return {
        id: doc.id as any,
        date: String(doc.createdAt),
        slug: doc.slug,
        title: { rendered: doc.title as string },
        excerpt: { rendered: '' },
        content: { rendered: doc.content_html as string || '' },
        acf: {
            chapitre_comprendre: doc.chapitre as string || '',
            lecon_comprendre: doc.numero_lecon as number || 0,
            security_level: 'PUBLIC',
            source_pdf_url: (doc.pdf_attachement && typeof doc.pdf_attachement === 'object' ? doc.pdf_attachement.url : null) || '',
            key_points: '',
            chart_data: ''
        },
        categories: [],
        _embedded: {
            'author': [{ name: 'Rédaction Comprendre' }],
            'wp:term': [[{ slug: 'comprendre', name: 'Comprendre', id: 999 }]],
            'wp:featuredmedia': []
        }
    } as any;
}

export async function generateMetadata(
    { params, searchParams }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params;
    const previewContext = await getPreviewContext(searchParams);
    const post = await getPost(slug, previewContext);

    if (!post) {
        return {
            title: '404 - Leçon Introuvable',
        };
    }

    const imageUrl = (post as any)?._embedded?.['wp:featuredmedia']?.[0]?.source_url || `${getPublicSiteOrigin()}/android-chrome-512x512.png`;
    const renderedTitle = (post as any)?.meta?.title || (typeof (post as any).title === 'string' ? (post as any).title : (post as any).title?.rendered || '');
    const renderedExcerpt = (post as any)?.meta?.description || (typeof (post as any).excerpt === 'string' ? (post as any).excerpt : (post as any).excerpt?.rendered || '');
    const cleanExcerpt = renderedExcerpt.replace(/<[^>]*>?/gm, '').slice(0, 160);

    return {
        title: `Leçon : ${renderedTitle} | L'Assez`,
        description: cleanExcerpt,
        openGraph: {
            title: `Leçon : ${renderedTitle} | L'Assez`,
            description: cleanExcerpt,
            images: [{ url: imageUrl }],
            type: 'article',
        },
        alternates: {
            canonical: `https://lassez.fr/comprendre/${slug}`,
        },
    };
}

export default async function ComprendreLessonPage({ params, searchParams }: Props) {
    const { slug } = await params;
    const previewContext = await getPreviewContext(searchParams);
    const post = await getPost(slug, previewContext);

    if (!post) {
        notFound();
    }

    const publishedHref = `${getPublicSiteOrigin()}/comprendre/${slug}`;
    const livePreviewServerURL = getApiOrigin();
    const isPreview = !!previewContext;

    // Plus besoin de filtrer la sécurité car la collection est 100% dédiées aux leçons

    return (
        <main>
            <div className="relative">
                {isPreview ? (
                    <PreviewShell
                        title={(post as any)?.title?.rendered || String((post as any).title || slug)}
                        publishedHref={publishedHref}
                        statusLabel={String((post as any)._status || 'draft').toUpperCase()}
                        updatedAt={String((post as any).updatedAt || (post as any).createdAt || '')}
                    >
                        <ComprendreLessonClient post={post} livePreviewServerURL={livePreviewServerURL} isPreview />
                    </PreviewShell>
                ) : (
                    <ComprendreLessonClient post={post} livePreviewServerURL={livePreviewServerURL} />
                )}
            </div>
        </main>
    );
}
