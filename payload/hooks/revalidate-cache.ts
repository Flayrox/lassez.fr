import { revalidatePath, revalidateTag } from 'next/cache';
import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload';

/**
 * Hook d'invalidation automatique du cache Next.js (ISR)
 * 
 * Ce hook s'exécute immédiatement après toute création, modification ou suppression
 * d'un document dans Payload CMS. Il purge les caches de la page d'accueil,
 * des flux RSS/Sitemap et des pages d'articles pour garantir un affichage instantané.
 */
export const revalidateCacheAfterChange: CollectionAfterChangeHook = async ({ doc, previousDoc, collection, req }) => {
    // Si le document est un brouillon non publié, pas besoin de purger le cache public principal
    const isPublished = doc._status === 'published' || previousDoc?._status === 'published';

    if (isPublished) {
        try {
            // Purger la page d'accueil principale
            revalidatePath('/');

            // Purger les flux d'actualités et sitemaps
            revalidatePath('/rss.xml');
            revalidatePath('/news-sitemap.xml');
            revalidatePath('/sitemap.xml');

            // Si le document possède un slug, purger sa page dédiée
            if (doc.slug) {
                if (collection.slug === 'posts') {
                    revalidatePath(`/article/${doc.slug}`);
                    revalidatePath(`/preview/article/${doc.slug}`);
                } else if (collection.slug === 'lessons') {
                    revalidatePath(`/comprendre/${doc.slug}`);
                } else if (collection.slug === 'revelations') {
                    revalidatePath(`/revelations/${doc.slug}`);
                }
            }

            // Invalider les tags globaux de cache
            revalidateTag('site-posts');
            revalidateTag('site-settings');
        } catch (error) {
            console.error('[Cache Revalidation] Échec de la purge de cache:', error);
        }
    }

    return doc;
};

export const revalidateCacheAfterDelete: CollectionAfterDeleteHook = async ({ doc, collection }) => {
    try {
        revalidatePath('/');
        revalidatePath('/rss.xml');
        revalidatePath('/news-sitemap.xml');
        revalidatePath('/sitemap.xml');
        revalidateTag('site-posts');
    } catch (error) {
        console.error('[Cache Revalidation] Échec de la purge de cache après suppression:', error);
    }
};
