import type { CollectionConfig } from 'payload';
import { authenticatedOrPublishedPostRead, isAdminOrEditorOrOwner, isAuthor } from '../access';
import { lexicalHTML } from '@payloadcms/richtext-lexical';
import { getPublicSiteOrigin } from '../../lib/host-urls';
import { createPostPreviewToken } from '../../lib/preview-token';
import { slugifyEditorialValue } from '../lib/editorial';
import { createGeminiSeoHook } from '../hooks/seo-gemini';

function normalizePreviewPath(previewPath: string) {
    const raw = String(previewPath || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
        try {
            const parsed = new URL(raw);
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        } catch { return null; }
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

export const revelations: CollectionConfig = {
    slug: 'revelations',
    access: {
        read: authenticatedOrPublishedPostRead,
        create: isAuthor,
        update: isAdminOrEditorOrOwner,
        delete: isAdminOrEditorOrOwner,
    },
    admin: {
        useAsTitle: 'titre',
        defaultColumns: ['titre', 'niveau_alerte', '_status', 'createdAt'],
        description: 'Silo Révélations : Live feed orienté action rapide.',
        preview: ({ doc }: any) => {
            const slug = String(doc?.slug || doc?.id || '').trim();
            const previewId = String(doc?.id || '').trim();
            if (!slug || !previewId) return 'https://lassez.fr';

            const previewToken = createPostPreviewToken({ postId: previewId, slug });
            return `https://lassez.fr/api/preview?path=/revelations/${slug}&preview_id=${previewId}&preview_token=${previewToken}`;
        },
        livePreview: {
            url: ({ data }: any) => {
                const slug = String(data?.slug || data?.id || '').trim();
                const previewId = String(data?.id || '').trim();
                if (!slug || !previewId) return 'https://lassez.fr';

                const previewToken = createPostPreviewToken({ postId: previewId, slug });
                return `https://lassez.fr/api/preview?path=/revelations/${slug}&preview_id=${previewId}&preview_token=${previewToken}`;
            },
        },
    },
    hooks: {
        beforeValidate: [
            async ({ data }: any) => {
                const nextData = { ...(data || {}) };
                if (!nextData.slug && nextData.titre) {
                    nextData.slug = slugifyEditorialValue(nextData.titre);
                }
                return nextData;
            },
            createGeminiSeoHook({
                collectionLabel: 'revelations',
                titleFields: ['titre'],
                bodyFields: ['contenu_rapide', 'contenu_rapide_html'],
                outputMode: 'meta',
            }),
        ],
    },
    versions: {
        drafts: true,
    },
    fields: [
        {
            name: 'titre',
            type: 'text',
            required: true,
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'Slug URL de la révélation, généré depuis le titre si vide.',
            },
        },
        {
            name: 'contenu_rapide',
            type: 'richText',
            required: true,
            admin: {
                description: 'Le contenu brut de la révélation.',
            },
        },
        lexicalHTML('contenu_rapide', { name: 'contenu_rapide_html' }),
        {
            name: 'niveau_alerte',
            type: 'select',
            defaultValue: 'Public',
            options: [
                { label: 'Public', value: 'Public' },
                { label: 'Confidentiel', value: 'Confidentiel' },
            ],
            admin: {
                description: 'Niveau de classification de la révélation.',
            },
        },
        {
            name: 'zone_geo',
            type: 'select',
            defaultValue: 'france',
            options: [
                { label: 'France',         value: 'france' },
                { label: 'International',  value: 'international' },
            ],
            admin: {
                description: 'Zone géographique principale de la révélation (utilisée pour le filtre front).',
            },
        },
        {
            name: 'tags',
            type: 'relationship',
            relationTo: 'tags',
            hasMany: true,
            admin: {
                description: 'Tags thématiques pour le filtrage dans le flux Révélations.',
            },
        },
        {
            name: 'author',
            type: 'relationship',
            relationTo: 'authors',
            admin: {
                description: 'Auteur éditorial responsable de cette révélation.',
            },
        },
    ],
};
