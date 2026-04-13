import { redirect } from 'next/navigation';
import { getServerWpApiBaseUrl } from '../../../lib/wp-server-base';
import { WPPost } from '../../../types';

const WP_BASE = getServerWpApiBaseUrl();

type Props = {
    params: { slug: string };
};

async function getPost(slug: string): Promise<WPPost | null> {
    const res = await fetch(`${WP_BASE}/posts?slug=${slug}&_embed`, {
        next: { revalidate: 60 }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
}

/**
 * Cette route legacy fait une redirection 301 permanente vers /[categorie]/[slug].
 * Elle reste en place pour les liens externes et le SEO.
 * Les liens internes pointent directement vers la nouvelle URL via getArticleUrl().
 */
export default async function ArticleLegacyRedirect({ params }: Props) {
    const post = await getPost(params.slug);

    if (!post) {
        // Pas de redirect → Next.js affiche la 404
        return null;
    }

    const categories = post._embedded?.['wp:term']?.[0] || [];

    // Cas spéciaux déjà existants
    const isRevelation = categories.some((cat: any) => cat.slug === 'revelations');
    if (isRevelation) {
        redirect(`/revelations#${params.slug}`);
    }

    const isComprendre = categories.some((cat: any) => cat.slug === 'comprendre' || cat.name === 'Comprendre');
    if (isComprendre) {
        redirect(`/comprendre/${params.slug}`);
    }

    // Cas général : redirection vers le silo de catégorie
    const primaryCatSlug = categories[0]?.slug || 'article';
    redirect(`/${primaryCatSlug}/${params.slug}`);
}
