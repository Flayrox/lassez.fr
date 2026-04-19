import { redirect } from 'next/navigation';
import { applyPreviewParams, getPreviewContextFromRecord, withPreviewQuery } from '@/lib/wp-preview';
import { WPPost, WPCategory } from '@/types';
import { getPayloadClient } from '@/lib/payload';

type Props = {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getPost(slug: string, previewContext: ReturnType<typeof getPreviewContextFromRecord>): Promise<WPPost | null> {
    const payload = await getPayloadClient();
    const res = await payload.find({
        collection: 'posts',
        where: { slug: { equals: slug } },
        limit: 1,
        depth: 1,
        overrideAccess: previewContext !== null,
    });
    return (res.docs[0] as WPPost) || null;
}

/**
 * Cette route legacy fait une redirection 301 permanente vers /[categorie]/[slug].
 * Elle reste en place pour les liens externes et le SEO.
 * Les liens internes pointent directement vers la nouvelle URL via getArticleUrl().
 */
export default async function ArticleLegacyRedirect({ params, searchParams }: Props) {
    const { slug } = await params;
    const sParams = await searchParams;
    const previewContext = getPreviewContextFromRecord(sParams);
    const post = await getPost(slug, previewContext);

    if (!post) {
        // Pas de redirect → Next.js affiche la 404
        return null;
    }

    const categories = Array.isArray(post.categories) ? post.categories.filter((cat): cat is WPCategory => typeof cat === 'object') : [];

    // Cas spéciaux déjà existants
    const isRevelation = categories.some(cat => cat.slug === 'revelations');
    if (isRevelation) {
        redirect(withPreviewQuery(`/revelations/${slug}`, previewContext));
    }

    const isComprendre = categories.some(cat => cat.slug === 'comprendre' || cat.name === 'Comprendre');
    if (isComprendre) {
        redirect(withPreviewQuery(`/comprendre/${slug}`, previewContext));
    }

    // Cas général : redirection vers le silo de catégorie
    const primaryCatSlug = categories[0]?.slug || 'article';
    redirect(withPreviewQuery(`/${primaryCatSlug}/${slug}`, previewContext));
}
