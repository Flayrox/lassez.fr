import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerWpApiBaseUrl } from '../../../lib/wp-server-base';
import { WPPost } from '../../../types';
import ArticleClient from '../../../components/ArticleClient';
import Layout from '../../../components/Layout';
import Script from 'next/script';

const WP_BASE = getServerWpApiBaseUrl();

type Props = {
    params: { categorie: string; slug: string };
};

async function getPost(slug: string): Promise<WPPost | null> {
    const res = await fetch(`${WP_BASE}/posts?slug=${slug}&_embed`, {
        next: { revalidate: 60 }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
}

async function getRelatedPosts(categoryId: number, excludeId: number): Promise<WPPost[]> {
    const res = await fetch(`${WP_BASE}/posts?categories=${categoryId}&exclude=${excludeId}&per_page=3&_embed`, {
        next: { revalidate: 60 }
    });
    if (!res.ok) return [];
    return res.json();
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const post = await getPost(params.slug);

    if (!post) {
        return { title: '404 - Article Introuvable' };
    }

    const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://lassez.fr/android-chrome-512x512.png`;
    const description = post.excerpt.rendered.replace(/<[^>]*>?/gm, '').slice(0, 160);

    return {
        title: `${post.title.rendered} | L'Assez`,
        description,
        openGraph: {
            title: `${post.title.rendered} | L'Assez`,
            description,
            images: [{ url: imageUrl }],
            type: 'article',
        },
        alternates: {
            canonical: `https://lassez.fr/${params.categorie}/${params.slug}`,
        },
    };
}

export default async function ArticleSiloPage({ params }: Props) {
    const post = await getPost(params.slug);

    if (!post) {
        notFound();
    }

    const categories = post._embedded?.['wp:term']?.[0] || [];
    const primaryCatSlug = categories[0]?.slug || 'article';
    const primaryCatName = categories[0]?.name || 'Article';

    // Sécurité : si la catégorie WP ne correspond pas à l'URL demandée,
    // on laisse passer quand même (Google peut indexer les 2, canonical pointe vers la bonne)

    const categoryId = categories[0]?.id;
    const relatedPosts = categoryId ? await getRelatedPosts(categoryId, post.id) : [];

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://lassez.fr" },
            { "@type": "ListItem", "position": 2, "name": primaryCatName, "item": `https://lassez.fr/${primaryCatSlug}` },
            { "@type": "ListItem", "position": 3, "name": post.title.rendered, "item": `https://lassez.fr/${primaryCatSlug}/${post.slug}` },
        ]
    };

    const articleSchema = {
        "@context": "https://schema.org",
        "@type": "NewsArticle",
        "headline": post.title.rendered,
        "image": [post._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://lassez.fr/android-chrome-512x512.png`],
        "datePublished": post.date,
        "dateModified": (post as any).modified || post.date,
        "author": [{
            "@type": "Person",
            "name": post._embedded?.author?.[0]?.name || "Rédaction",
            "url": "https://lassez.fr/apropos"
        }],
        "publisher": {
            "@type": "Organization",
            "name": "L'Assez",
            "logo": { "@type": "ImageObject", "url": "https://lassez.fr/android-chrome-512x512.png" }
        }
    };

    return (
        <Layout>
            <Script id={`json-ld-breadcrumb-${post.id}`} type="application/ld+json" strategy="beforeInteractive">
                {JSON.stringify(breadcrumbSchema)}
            </Script>
            <Script id={`json-ld-article-${post.id}`} type="application/ld+json" strategy="beforeInteractive">
                {JSON.stringify(articleSchema)}
            </Script>
            <ArticleClient post={post} relatedPosts={relatedPosts} slug={params.slug} />
        </Layout>
    );
}
