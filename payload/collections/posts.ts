import type { CollectionConfig } from 'payload';
import { authenticatedOrPublishedPostRead, isAuthenticated } from '../access';
import { getPublicSiteOrigin } from '../../lib/host-urls';
import { createPostPreviewToken } from '../../lib/preview-token';
import { buildPostPreviewUrl, getPublishedAtDefault, resolveCanonicalArticlePath, resolvePrimaryCategorySlug, slugifyEditorialValue } from '../lib/editorial';
import { createGeminiSeoHook } from '../hooks/seo-gemini';
import { lexicalHTML } from '@payloadcms/richtext-lexical';

function normalizePreviewPath(previewPath: string) {
    const raw = String(previewPath || '').trim();
    if (!raw) return null;

    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch {
            return null;
        }
    }

    return raw.startsWith('/') ? raw : `/${raw}`;
}

function buildSignedPreviewUrl(args: { origin: string; path: string; previewId: string; slug: string }) {
    const previewToken = createPostPreviewToken({ postId: args.previewId, slug: args.slug });
    if (!args.previewId || !previewToken) {
        return `${args.origin}${args.path}`;
    }

    const previewUrl = new URL('/api/preview', args.origin);
    previewUrl.searchParams.set('path', args.path);
    previewUrl.searchParams.set('preview_id', args.previewId);
    previewUrl.searchParams.set('preview_token', previewToken);
    return previewUrl.toString();
}

function resolveEditorialPreviewPath(slug: string) {
    const cleanSlug = String(slug || '').trim();
    if (!cleanSlug) return null;
    return `/preview/article/${cleanSlug}`;
}

async function ensurePostDefaults({ data, req, originalDoc }: any) {
    const nextData = { ...(data || {}) };

    if (!nextData.slug && nextData.title) {
        nextData.slug = slugifyEditorialValue(nextData.title);
    }

    if (!nextData.seoTitle && nextData.title) {
        nextData.seoTitle = String(nextData.title).trim();
    }

    if (!nextData.publishedAt && nextData._status === 'published') {
        nextData.publishedAt = getPublishedAtDefault(nextData.publishedAt || originalDoc?.publishedAt);
    }

    if (!nextData.seoDescription && nextData.excerpt) {
        nextData.seoDescription = String(nextData.excerpt).trim();
    }

    if (!nextData.canonicalUrl) {
        const baseDoc = { ...(originalDoc || {}), ...nextData };
        const primaryCategorySlug = await resolvePrimaryCategorySlug(baseDoc, req);
        nextData.canonicalUrl = resolveCanonicalArticlePath(String(nextData.slug || originalDoc?.slug || ''), primaryCategorySlug) || nextData.canonicalUrl;
    }

    if (nextData.featuredImage && (!nextData.meta || !nextData.meta.image)) {
        nextData.meta = { ...(nextData.meta || {}), image: nextData.featuredImage };
    }

    return nextData;
}

const generatePostsSeo = createGeminiSeoHook({
    collectionLabel: 'posts',
    titleFields: ['title'],
    bodyFields: ['excerpt', 'content', 'content_html'],
    outputMode: 'meta',
});

export const posts = {
    slug: 'posts',
    access: {
        read: authenticatedOrPublishedPostRead,
        create: isAuthenticated,
        update: isAuthenticated,
        delete: isAuthenticated,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'slug', '_status', 'publishedAt'],
        description: 'Dossier éditorial avec preview, SEO et taxonomies.',
        preview: async ({ doc, req }: any) => {
            const previewPath = resolveEditorialPreviewPath(String(doc?.slug || '')) || await buildPostPreviewUrl(doc, req);
            if (!previewPath) return null;

            // Use the req origin, but remove "api." prefix if Payload was accessed via a subdomain
            // since Next.js preview route is always on the main frontend domain
            let protocol = req?.headers?.get('x-forwarded-proto') || req?.protocol || 'http';
            let host = req?.headers?.get('host') || 'localhost:5173';
            
            if (host.startsWith('api.')) {
                host = host.substring(4);
            }
            
            const origin = `${protocol}://${host}`;

            const normalizedPath = normalizePreviewPath(previewPath);
            if (!normalizedPath) return null;

            const previewId = String(doc?.id || '').trim();
            const slug = String(doc?.slug || '').trim();
            const previewToken = createPostPreviewToken({ postId: previewId, slug });

            if (!previewId || !previewToken) {
                return `${origin}${normalizedPath}`;
            }

            const previewUrl = new URL('/api/preview', origin);
            previewUrl.searchParams.set('path', normalizedPath);
            previewUrl.searchParams.set('preview_id', previewId);
            previewUrl.searchParams.set('preview_token', previewToken);
            return previewUrl.toString();
        },
        livePreview: {
            url: async ({ data, req }: any) => {
                const previewPath = resolveEditorialPreviewPath(String(data?.slug || '')) || await buildPostPreviewUrl(data, req);
                if (!previewPath) return getPublicSiteOrigin();
                
                // Get correct origin dynamically from the request headers to support both localhost and IP access:
                const protocol = req?.headers?.get('x-forwarded-proto') || req?.protocol || 'http';
                let host = req?.headers?.get('host') || 'localhost:5173';
                
                if (host.startsWith('api.')) {
                    host = host.substring(4);
                }
                
                const origin = `${protocol}://${host}`;
                
                const normalizedPath = normalizePreviewPath(previewPath);
                if (!normalizedPath) return getPublicSiteOrigin();

                const previewId = String(data?.id || '').trim();
                const slug = String(data?.slug || '').trim();

                if (!previewId || !slug) {
                    return `${origin}${normalizedPath}`;
                }

                return buildSignedPreviewUrl({
                    origin,
                    path: normalizedPath,
                    previewId,
                    slug,
                });
            },
        },
    },
    hooks: {
        beforeValidate: [ensurePostDefaults, generatePostsSeo],
    },
    versions: {
        drafts: true,
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
            admin: {
                description: 'Titre principal affiché sur le site et utilisé pour le slug si celui-ci est vide.',
            },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'Identifiant URL. Il est auto-rempli à partir du titre quand il est vide.',
            },
        },
        {
            name: 'excerpt',
            type: 'textarea',
            admin: {
                description: 'Accroche courte utilisée dans les cartes et le référencement social.',
            },
        },
        {
            name: 'content',
            type: 'richText',
            required: true,
            admin: {
                description: 'Corps de l’article. C’est le contenu publié sur le front.',
            },
        },
        lexicalHTML('content', { name: 'content_html' }),
        {
            name: 'categories',
            type: 'relationship',
            relationTo: 'categories',
            hasMany: true,
            required: true,
            admin: {
                description: 'Choisis au moins une catégorie pour déterminer le silo front et la route canonique.',
            },
        },
        {
            name: 'tags',
            type: 'relationship',
            relationTo: 'tags',
            hasMany: true,
            admin: {
                description: 'Étiquettes optionnelles pour affiner le tri et les filtres.',
            },
        },
        {
            name: 'author',
            type: 'relationship',
            relationTo: 'authors',
            admin: {
                description: 'Auteur éditorial responsable du contenu.',
            },
        },
        {
            name: 'featuredImage',
            type: 'upload',
            relationTo: 'media',
            admin: {
                description: 'Image principale utilisée dans les listings et partages.',
            },
        },
        {
            name: 'publishedAt',
            type: 'date',
            admin: {
                description: 'Date de publication. Si l’article passe en publié sans date, elle est renseignée automatiquement.',
            },
        },
        {
            name: 'acf',
            type: 'group',
            admin: {
                description: 'Champs additionnels flexibles (Advanced Custom Fields)',
            },
            fields: [
                {
                    name: 'key_points',
                    type: 'textarea',
                    admin: {
                        description: 'Points clés affichés sous forme de liste (un par ligne).',
                    },
                },
                {
                    name: 'chart_data',
                    type: 'textarea',
                    admin: {
                        description: 'Données (JSON ou CSV) injectées dans le composant BarChart ou semblable.',
                    },
                },
                {
                    name: 'sourcePdfUrl',
                    type: 'text',
                    admin: {
                        description: 'Lien source ou document de référence associé à l’article.',
                    },
                },
                {
                    name: 'securityLevel',
                    type: 'select',
                    defaultValue: 'PUBLIC',
                    options: [
                        { label: 'PUBLIC', value: 'PUBLIC' },
                        { label: 'CONFIDENTIEL', value: 'CONFIDENTIEL' },
                    ],
                    admin: {
                        description: 'Niveau de confidentialité du contenu.',
                    },
                },
                {
                    name: 'chapitre_comprendre',
                    type: 'text',
                    admin: {
                        description: 'Métadonnée éditoriale spécifique au silo Comprendre.',
                    },
                },
                {
                    name: 'lecon_comprendre',
                    type: 'number',
                    admin: {
                        description: 'Numéro de leçon spécifique au silo Comprendre.',
                    },
                },
            ],
        },
    ],
} satisfies CollectionConfig;