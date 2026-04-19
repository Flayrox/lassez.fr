import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { getPayloadClient } from '@/lib/payload';
import { getPreviewContext } from '@/lib/wp-preview';
import { getApiOrigin, getPublicSiteOrigin } from '@/lib/host-urls';
import ArticleClient from '@/components/ArticleClient';
import Layout from '@/components/Layout';
import PreviewShell from '@/components/PreviewShell';
import JsonLd from '@/components/JsonLd';
import type { Post, Category } from '@/payload-types';

type Props = {
    params: Promise<{ category: string; slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Récupère un article depuis Payload (avec fallback sur revelations si besoin). */
async function fetchPost(slug: string, previewContext: any) {
    const payload = await getPayloadClient();

    const res = await payload.find({
        collection: 'posts',
        where:  { slug: { equals: slug } },
        limit:  1,
        depth:  2,       // depth 2 pour avoir les objets catégorie complets
        overrideAccess: !!previewContext,
        draft:          !!previewContext,
    });

    return res.docs[0] ?? null;
}

/** Récupère les articles liés (même catégorie primaire, exclut l'article courant). */
async function fetchRelated(post: Post) {
    try {
        const payload = await getPayloadClient();
        const cats = (post.categories ?? []) as (Category | string | number)[];
        const catIds = cats.map(c => (typeof c === 'object' ? c.id : c));
        if (!catIds.length) return [];

        const res = await payload.find({
            collection: 'posts',
            where: {
                and: [
                    { id:         { not_equals: post.id } },
                    { categories: { in: catIds } },
                    { _status:    { equals: 'published' } },
                ],
            },
            limit: 3,
            depth: 1,
        });
        return res.docs as Post[];
    } catch {
        return [];
    }
}

// ─── Metadata ────────────────────────────────────────────────────────────────
export async function generateMetadata(
    { params, searchParams }: Props,
    _parent: ResolvingMetadata
): Promise<Metadata> {
    const { category, slug } = await params;
    const previewContext = await getPreviewContext(searchParams);
    const post = await fetchPost(slug, previewContext);

    if (!post) return { title: '404 – Article Introuvable' };

    const title = post.title ?? slug;
    const imageUrl = (typeof post.featuredImage === 'object' && post.featuredImage?.url)
        ? post.featuredImage.url
        : 'https://lassez.fr/android-chrome-512x512.png';

    return {
        title: `${title} | L'Assez`,
        description: post.excerpt ?? undefined,
        openGraph: {
            title: `${title} | L'Assez`,
            description: post.excerpt ?? undefined,
            images:      [{ url: imageUrl }],
            type:        'article',
        },
        alternates: {
            canonical: `https://lassez.fr/${category}/${slug}`,
        },
    };
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function CentralizedArticlePage({ params, searchParams }: Props) {
    const { category, slug } = await params;
    const previewContext = await getPreviewContext(searchParams);
    const post = await fetchPost(slug, previewContext);

    if (!post) notFound();

    const title      = post.title ?? slug;
    const relatedRaw = await fetchRelated(post);
    const publishedHref = `${getPublicSiteOrigin()}/${category}/${slug}`;
    const livePreviewServerURL = getApiOrigin();
    const isPreview = !!previewContext;

    // ── JSON-LD ──────────────────────────────────────────────────────────────
    const siteUrl   = 'https://lassez.fr';
    const pageUrl   = `${siteUrl}/${category}/${slug}`;
    const imageUrl  = (typeof post.featuredImage === 'object' && post.featuredImage?.url)
        ? post.featuredImage.url
        : `${siteUrl}/android-chrome-512x512.png`;
    const authorName = (typeof post.author === 'object' && post.author?.name) ? post.author.name : 'Rédaction';

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type':    'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil',          item: siteUrl },
            { '@type': 'ListItem', position: 2, name: category.toUpperCase(), item: `${siteUrl}/${category}` },
            { '@type': 'ListItem', position: 3, name: title,              item: pageUrl },
        ],
    };

    const articleSchema = {
        '@context':     'https://schema.org',
        '@type':        'NewsArticle',
        headline:       title,
        image:          [imageUrl],
        datePublished:  post.publishedAt ?? post.createdAt,
        dateModified:   post.updatedAt ?? post.createdAt,
        author:         [{ '@type': 'Person', name: authorName }],
        publisher: {
            '@type': 'Organization',
            name:    "L'Assez",
            logo:    { '@type': 'ImageObject', url: `${siteUrl}/android-chrome-512x512.png` },
        },
    };

    const article = (
        <ArticleClient
            post={post as any}
            relatedPosts={relatedRaw as any[]}
            slug={slug}
            isPreview={isPreview}
            livePreviewServerURL={livePreviewServerURL}
        />
    );

    if (isPreview) {
        return (
            <Layout>
                <PreviewShell
                    title={title}
                    publishedHref={publishedHref}
                    statusLabel={String((post as any).status || 'draft').toUpperCase()}
                    updatedAt={String((post as any).updatedAt || (post as any).createdAt || '')}
                >
                    {article}
                </PreviewShell>
            </Layout>
        );
    }

    return (
        <Layout>
            {!isPreview && <JsonLd id={`ld-breadcrumb-${post.id}`} data={breadcrumbSchema} />}
            {!isPreview && <JsonLd id={`ld-article-${post.id}`} data={articleSchema} />}
            {article}
        </Layout>
    );
}
