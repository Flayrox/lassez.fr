import type { CollectionConfig } from 'payload';
import { authenticatedOrPublishedPostRead, isAdminOrEditorOrOwner, isAuthor } from '../access';
import { lexicalHTML } from '@payloadcms/richtext-lexical';
import { getPublicSiteOrigin } from '../../lib/host-urls';
import { createPostPreviewToken } from '../../lib/preview-token';
import { createGeminiSeoHook } from '../hooks/seo-gemini';
import { revalidateCacheAfterChange, revalidateCacheAfterDelete } from '../hooks/revalidate-cache';

export const lessons: CollectionConfig = {
    slug: 'lessons',
    access: {
        read: authenticatedOrPublishedPostRead,
        create: isAuthor,
        update: isAdminOrEditorOrOwner,
        delete: isAdminOrEditorOrOwner,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'chapitre', 'numero_lecon', 'niveau_difficulte', 'status'],
        description: 'Silo Comprendre : Collection 100% didactique.',
        preview: ({ doc }: any) => {
            const slug = String(doc?.slug || '').trim();
            const previewId = String(doc?.id || '').trim();
            if (!slug) return 'https://lassez.fr';

            return `https://lassez.fr/api/preview?path=/comprendre/${slug}&preview_id=${previewId}`;
        },
        livePreview: {
            url: ({ data }: any) => {
                const slug = String(data?.slug || '').trim();
                if (!slug) return 'https://lassez.fr';

                return `https://lassez.fr/comprendre/${slug}`;
            },
        },
    },
    hooks: {
        beforeValidate: [createGeminiSeoHook({
            collectionLabel: 'lessons',
            titleFields: ['title', 'chapitre'],
            bodyFields: ['content', 'content_html', 'chapitre'],
            outputMode: 'meta',
        })],
        afterChange: [revalidateCacheAfterChange],
        afterDelete: [revalidateCacheAfterDelete],
    },
    versions: {
        drafts: true,
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            required: true,
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
        },
        {
            name: 'content',
            type: 'richText',
            required: true,
        },
        lexicalHTML('content', { name: 'content_html' }),
        {
            name: 'chapitre',
            type: 'text',
            required: true,
            admin: {
                description: 'Le chapitre auquel appartient cette leçon.',
            },
        },
        {
            name: 'numero_lecon',
            type: 'number',
            required: true,
            admin: {
                description: "L'ordre de la leçon dans le chapitre.",
            },
        },
        {
            name: 'niveau_difficulte',
            type: 'select',
            options: [
                { label: 'Débutant', value: 'debutant' },
                { label: 'Intermédiaire', value: 'intermediaire' },
                { label: 'Avancé', value: 'avance' },
            ],
            defaultValue: 'debutant',
        },
        {
            name: 'pdf_attachement',
            type: 'upload',
            relationTo: 'media',
            admin: {
                description: 'Fiche PDF récapitulative téléchargeable.',
            },
        },
    ],
};
