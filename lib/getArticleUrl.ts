import type { Post } from './types';

/**
 * Chemin canonique d'un article :
 * - /revelations/[slug] pour la catégorie revelations
 * - /comprendre/[slug] pour la catégorie comprendre
 * - /[categorie]/[slug] sinon
 * - /article/[slug] si pas de catégorie
 */
export function resolveCanonicalArticlePath(slug: string, categorySlug?: string | null) {
  const cleanSlug = String(slug || '').trim();
  if (!cleanSlug) return null;

  const cleanCategorySlug = String(categorySlug || '').trim();
  if (!cleanCategorySlug) return `/article/${cleanSlug}`;
  if (cleanCategorySlug === 'revelations') return `/revelations/${cleanSlug}`;
  if (cleanCategorySlug === 'comprendre') return `/comprendre/${cleanSlug}`;
  return `/${cleanCategorySlug}/${cleanSlug}`;
}

/**
 * Retourne l'URL en silo d'un article : /[categorie]/[slug]
 * - Si catégorie = revelations → /revelations/[slug]
 * - Sinon → /[cat.slug]/[post.slug]
 * - Fallback si pas de catégorie → /article/[slug] (redirigé en 301)
 */
export function getArticleUrl(post: Post): string {
  const categories = post.categories || [];
  let primaryCategorySlug = null;
  if (categories.length > 0) {
    const cat = categories[0];
    primaryCategorySlug = typeof cat === 'object' && cat !== null ? cat.slug : null;
  }
  return resolveCanonicalArticlePath(post.slug, primaryCategorySlug) || `/article/${post.slug}`;
}

/**
 * Retourne le slug de la catégorie primaire d'un article.
 * Utilisé pour la page [categorie]/[slug] et le BreadcrumbList.
 */
export function getArticleCategorySlug(post: Post): string {
  const categories = post.categories || [];
  if (categories.length === 0) return 'article';
  const cat = categories[0];
  return (typeof cat === 'object' && cat !== null) ? cat.slug : 'article';
}
