import { WPPost } from '../types';

/**
 * Retourne l'URL en silo d'un article : /[categorie]/[slug]
 * - Si catégorie = revelations → /revelations/[slug]
 * - Sinon → /[cat.slug]/[post.slug]
 * - Fallback si pas de catégorie → /article/[slug] (redirigé en 301)
 */
export function getArticleUrl(post: WPPost): string {
  const categories = post._embedded?.['wp:term']?.[0] || [];

  if (categories.length === 0) {
    return `/article/${post.slug}`;
  }

  const primaryCat = categories[0];

  if (primaryCat.slug === 'revelations') {
    return `/revelations/${post.slug}`;
  }

  if (primaryCat.slug === 'comprendre') {
    return `/comprendre/${post.slug}`;
  }

  return `/${primaryCat.slug}/${post.slug}`;
}

/**
 * Retourne le slug de la catégorie primaire d'un article.
 * Utilisé pour la page [categorie]/[slug] et le BreadcrumbList.
 */
export function getArticleCategorySlug(post: WPPost): string {
  const categories = post._embedded?.['wp:term']?.[0] || [];
  if (categories.length === 0) return 'article';
  return categories[0].slug;
}
