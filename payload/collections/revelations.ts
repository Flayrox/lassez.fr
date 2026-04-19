import type { CollectionConfig } from 'payload';
import { authenticatedOrPublishedPostRead, isAuthenticated } from '../access';
import { lexicalHTML } from '@payloadcms/richtext-lexical';
import { getPublicSiteOrigin } from '../../lib/host-urls';
import { createPostPreviewToken } from '../../lib/preview-token';

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
        create: isAuthenticated,
        update: isAuthenticated,
        delete: isAuthenticated,
    },
    admin: {
        useAsTitle: 'titre',
        defaultColumns: ['titre', 'niveau_alerte', '_status', 'createdAt'],
        description: 'Silo Révélations : Live feed orienté action rapide.',
        preview: async ({ doc }: any) => {
            const origin = getPublicSiteOrigin();
            const previewPath = doc?.id ? `/revelations/${doc.id}` : null;
            const normalizedPath = previewPath ? normalizePreviewPath(previewPath) : null;
            if (!normalizedPath) return null;

            const previewId = String(doc?.id || '').trim();
            const slug = previewId;
            const previewToken = createPostPreviewToken({ postId: previewId, slug });

            if (!previewId || !previewToken) return `${origin}${normalizedPath}`;

            const previewUrl = new URL('/api/preview', origin);
            previewUrl.searchParams.set('path', normalizedPath);
            previewUrl.searchParams.set('preview_id', previewId);
            previewUrl.searchParams.set('preview_token', previewToken);
            return previewUrl.toString();
        },
        livePreview: {
            url: async ({ data }: any) => {
                const previewPath = data?.id ? `/revelations/${data.id}` : null;
                if (!previewPath) return 'http://localhost:5173';
                const origin = getPublicSiteOrigin();
                const normalizedPath = normalizePreviewPath(previewPath);
                if (!normalizedPath) return 'http://localhost:5173';

                const previewId = String(data?.id || '').trim();
                const slug = previewId;

                if (!previewId) {
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
    ],
};
