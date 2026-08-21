import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPayloadClient } from '@/lib/payload';
import CategoryClient from '@/components/CategoryClient';
import Layout from '@/components/Layout';
import type { Category, Post } from '@/types';

type Props = {
    params: Promise<{ category: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { category } = await params;
    return {
        title: `${category.charAt(0).toUpperCase() + category.slice(1)} | L'Assez`,
        description: `Tous les dossiers de la catégorie ${category}.`,
        alternates: {
            canonical: `https://lassez.fr/${category}`,
        },
    };
}

/**
 * Page de catégorie (silo) : /[category]
 * Affiche la liste des articles publiés de la catégorie via CategoryClient.
 * Les pages statiques (enquetes, revelations, comprendre…) priment sur ce
 * segment dynamique dans Next.js, donc aucun conflit de routage.
 */
export default async function CategoryPage({ params }: Props) {
    const { category } = await params;
    const payload = await getPayloadClient();

    const catRes = await payload.find({
        collection: 'categories',
        where: { slug: { equals: category } },
        limit: 1,
    });
    const initialCategory = (catRes.docs[0] as Category) ?? null;

    if (!initialCategory) notFound();

    const postsRes = await payload.find({
        collection: 'posts',
        where: {
            and: [
                { _status: { equals: 'published' } },
                { categories: { equals: initialCategory.id } },
            ],
        },
        limit: 10,
        depth: 1,
        sort: '-publishedAt',
    });
    const initialPosts = postsRes.docs as Post[];

    return (
        <Layout>
            <CategoryClient
                slug={category}
                initialCategory={initialCategory as any}
                initialPosts={initialPosts as any}
            />
        </Layout>
    );
}
