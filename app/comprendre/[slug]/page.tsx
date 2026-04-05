import { Metadata, ResolvingMetadata } from 'next';
import { notFound } from 'next/navigation';
import { WP_API_URL } from '../../../lib/api';
import { WPPost } from '../../../types';
import ComprendreLessonClient from '../../../components/ComprendreLessonClient';

type Props = {
    params: { slug: string };
};

async function getPost(slug: string): Promise<WPPost | null> {
    const res = await fetch(`${WP_API_URL}/posts?slug=${slug}&_embed`, {
        next: { revalidate: 60 } // Revalidate every minute
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
}

export async function generateMetadata(
    { params }: Props,
    parent: ResolvingMetadata
): Promise<Metadata> {
    const slug = params.slug;
    const post = await getPost(slug);

    if (!post) {
        return {
            title: '404 - Leçon Introuvable',
        };
    }

    const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://picsum.photos/seed/${post.id}/1200/600`;

    return {
        title: `Leçon : ${post.title.rendered} | L'Assez`,
        description: post.excerpt.rendered.replace(/<[^>]*>?/gm, '').slice(0, 160),
        openGraph: {
            title: `Leçon : ${post.title.rendered} | L'Assez`,
            description: post.excerpt.rendered.replace(/<[^>]*>?/gm, '').slice(0, 160),
            images: [{ url: imageUrl }],
        },
    };
}

export default async function ComprendreLessonPage({ params }: Props) {
    const post = await getPost(params.slug);

    if (!post) {
        notFound();
    }

    // Sécurité: vérifier si c'est bien une catégorie Comprendre
    const categories = post._embedded?.['wp:term']?.[0] || [];
    const isComprendre = categories.some((cat: any) => cat.slug === 'comprendre' || cat.name === 'Comprendre');

    if (!isComprendre) {
        // Redirige vers la page article standard si ce n'est pas un cours
        return (
            <main>
                <div className="py-20 text-center text-ink bg-paper min-h-screen">
                    <h1 className="text-2xl font-black uppercase">Erreur de Document</h1>
                    <p className="mt-4 font-serif">Ce document ne fait pas partie du cursus éducatif.</p>
                </div>
            </main>
        );
    }

    return (
        <main>
            <ComprendreLessonClient post={post} />
        </main>
    );
}
