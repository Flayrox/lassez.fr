import type { CollectionConfig } from 'payload';
import { authenticatedOrPublishedPostRead, isAdminOrEditorOrOwner, isAuthor } from '../access';
import { lexicalHTML } from '@payloadcms/richtext-lexical';
import { getPublicSiteOrigin } from '../../lib/host-urls';
import { createPostPreviewToken } from '../../lib/preview-token';
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
                description: 'L\'ordre de la leçon dans le chapitre.',
            },
        },
        {
            name: 'niveau_difficulte',
            type: 'select',
            defaultValue: 'debute',
            options: [
                { label: 'Débutant', value: 'debute' },
                { label: 'Intermédiaire', value: 'intermediaire' },
                { label: 'Avancé', value: 'avance' },
            ],
            admin: {
                description: 'La difficulté de la leçon.',
            },
        },
        {
            name: 'pdf_attachement',
            type: 'upload',
            relationTo: 'media',
            admin: {
                description: 'Un fichier PDF optionnel attaché à la leçon.',
            },
        },
        {
            name: 'status',
            type: 'select',
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
            ],
        },
        {
            name: 'author',
            type: 'relationship',
            relationTo: 'authors',
            admin: {
                description: 'Auteur éditorial responsable de cette leçon.',
            },
        },
    ],
};
