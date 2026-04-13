import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { getServerWpApiBaseUrl } from '../../../lib/wp-server-base';
import { WPPost, WPCategory } from '../../../types';
import CategoryClient from '../../../components/CategoryClient';
import Layout from '../../../components/Layout';
import Script from 'next/script';

const WP_BASE = getServerWpApiBaseUrl();

type Props = {
    params: { slug: string };
};

// Fetch the category to get ID and Name
async function getCategoryBySlug(slug: string): Promise<WPCategory | null> {
    const res = await fetch(`${WP_BASE}/categories?slug=${slug}`);
    if (!res.ok) return null;
    const categories = await res.json();
    return categories.length > 0 ? categories[0] : null;
}

// Fetch initial posts for SSR
async function getInitialPosts(categoryId: number | undefined): Promise<WPPost[]> {
    if (!categoryId) return [];
    // The useInfinitePosts hook uses per_page=9 by default.
    const res = await fetch(`${WP_BASE}/posts?categories=${categoryId}&per_page=9&_embed`, {
        next: { revalidate: 60 } // Revalidate every minute
    });
    if (!res.ok) return [];
    return res.json();
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const slug = params.slug;
    const category = await getCategoryBySlug(slug);

    if (!category) {
        return { title: '404 - Catégorie Introuvable' };
    }

    const description = `Tous les articles d'investigation de L'Assez dans la catégorie ${category.name}. Enquêtes, révélations et analyses.`;

    return {
        title: `Dossiers: ${category.name} | L'Assez`,
        description,
        openGraph: {
            title: `Dossiers: ${category.name} | L'Assez`,
            description,
            type: 'website',
        },
        alternates: {
            canonical: `https://lassez.fr/category/${category.slug}`,
        },
    };
}

export default async function CategoryPage({ params }: Props) {
    const category = await getCategoryBySlug(params.slug);

    if (!category) {
        notFound();
    }

    const initialPosts = await getInitialPosts(category.id);

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://lassez.fr" },
            { "@type": "ListItem", "position": 2, "name": category.name, "item": `https://lassez.fr/category/${category.slug}` },
        ]
    };

    return (
        <Layout>
            <Script id={`json-ld-cat-${category.slug}`} type="application/ld+json" strategy="beforeInteractive">
                {JSON.stringify(breadcrumbSchema)}
            </Script>
            <CategoryClient slug={params.slug} initialCategory={category} initialPosts={initialPosts} />
        </Layout>
    );
}
