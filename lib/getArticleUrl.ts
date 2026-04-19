import { WPPost, WPCategory } from '../types';
import { resolveCanonicalArticlePath } from '../payload/lib/editorial';

/**
 * Retourne l'URL en silo d'un article : /[categorie]/[slug]
 * - Si catégorie = revelations → /revelations/[slug]
 * - Sinon → /[cat.slug]/[post.slug]
 * - Fallback si pas de catégorie → /article/[slug] (redirigé en 301)
 */
export function getArticleUrl(post: WPPost): string {
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
export function getArticleCategorySlug(post: WPPost): string {
  const categories = post.categories || [];
  if (categories.length === 0) return 'article';
  const cat = categories[0];
  return (typeof cat === 'object' && cat !== null) ? cat.slug : 'article';
}
