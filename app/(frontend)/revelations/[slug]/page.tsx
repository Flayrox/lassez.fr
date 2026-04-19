import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { getPayloadClient } from '@/lib/payload';
import { getApiOrigin, getPublicSiteOrigin } from '@/lib/host-urls';
import { getPreviewContext } from '@/lib/wp-preview';
import { WPPost } from '@/types';
import ArticleClient from '@/components/ArticleClient';
import Layout from '@/components/Layout';
import PreviewShell from '@/components/PreviewShell';
import JsonLd from '@/components/JsonLd';

type Props = {
    params: Promise<{ slug: string }>; 
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getPost(id: string, previewContext: ReturnType<typeof getPreviewContext> extends Promise<infer T> ? T : never): Promise<WPPost | null> {
    const payload = await getPayloadClient();
    try {
        const doc = await payload.findByID({
            collection: 'revelations',
            id,
            draft: !!previewContext,
            overrideAccess: !!previewContext,
        });
        
        if (!doc) return null;

        return {
            id: doc.id as any,
            date: String(doc.createdAt),
            slug: doc.id,
            title: { rendered: doc.titre as string },
            excerpt: { rendered: '' },
            content: { rendered: doc.contenu_rapide_html as string || '' },
            acf: {
                security_level: doc.niveau_alerte as string || 'PUBLIC',
            },
            categories: [],
            _embedded: {
                'author': [{ name: 'Silo Révélations' }],
                'wp:term': [[{ slug: 'revelations', name: 'Révélations', id: 998 }]],
                'wp:featuredmedia': []
            }
        } as any;
    } catch {
        return null;
    }
}

async function getRelatedPosts(id: string): Promise<WPPost[]> {
    // Currently no related posts for specific payload revelation
    return [];
}

export async function generateMetadata(
    { params, searchParams }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const { slug } = await params;
    const previewContext = await getPreviewContext(searchParams);
    const post = await getPost(slug, previewContext);

    if (!post) {
        return { title: '404 - Révélations Introuvable' };
    }

    // Not checking WP categories anymore since it's an explicit Revelation from DB

    const imageUrl = `${getPublicSiteOrigin()}/android-chrome-512x512.png`;
    const description = "Une révélation confidentielle L'Assez";
    const renderedTitle = typeof (post as any).title === 'string' ? (post as any).title : (post as any).title?.rendered || '';

    return {
        title: `${renderedTitle} | L'Assez`,
        description,
        openGraph: {
            title: `${renderedTitle} | L'Assez`,
            description,
            images: [{ url: imageUrl }],
            type: 'article',
        },
        alternates: {
            canonical: `https://lassez.fr/revelations/${slug}`,
        },
    };
}

export default async function RevelationArticlePage({ params, searchParams }: Props) {
    const { slug } = await params;
    const previewContext = await getPreviewContext(searchParams);
    const post = await getPost(slug, previewContext);

    if (!post) {
        notFound();
    }

    const relatedPosts = await getRelatedPosts(String(post.id));
    const renderedTitle = typeof (post as any).title === 'string' ? (post as any).title : (post as any).title?.rendered || '';
    const featuredImage = (post as any)?._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://lassez.fr/android-chrome-512x512.png`;
    const authorName = (post as any)?._embedded?.author?.[0]?.name || 'Rédaction';
    const publishedDate = (post as any).date || String((post as any).createdAt || new Date().toISOString());
    const publishedHref = `${getPublicSiteOrigin()}/revelations/${slug}`;
    const livePreviewServerURL = getApiOrigin();
    const isPreview = !!previewContext;

    const article = (
        <ArticleClient post={post} relatedPosts={relatedPosts} slug={slug} isPreview={isPreview} livePreviewServerURL={livePreviewServerURL} />
    );

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://lassez.fr' },
            { '@type': 'ListItem', position: 2, name: 'Révélations', item: 'https://lassez.fr/revelations' },
            { '@type': 'ListItem', position: 3, name: renderedTitle, item: `https://lassez.fr/revelations/${post.slug}` },
        ],
    };

    const articleSchema = {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: renderedTitle,
        image: [featuredImage],
        datePublished: publishedDate,
        dateModified: (post as any).modified || publishedDate,
        author: [{
            '@type': 'Person',
            name: authorName,
            url: 'https://lassez.fr/apropos',
        }],
        publisher: {
            '@type': 'Organization',
            name: 'L\'Assez',
            logo: { '@type': 'ImageObject', url: 'https://lassez.fr/android-chrome-512x512.png' },
        },
    };

    return (
        <Layout>
            {!isPreview && <JsonLd id={`json-ld-breadcrumb-${post.id}`} data={breadcrumbSchema} />}
            {!isPreview && <JsonLd id={`json-ld-article-${post.id}`} data={articleSchema} />}

            {isPreview ? (
                <PreviewShell
                    title={renderedTitle}
                    publishedHref={publishedHref}
                    statusLabel={String((post as any).status || 'draft').toUpperCase()}
                    updatedAt={String((post as any).updatedAt || (post as any).createdAt || '')}
                >
                    {article}
                </PreviewShell>
            ) : article}
        </Layout>
    );
}