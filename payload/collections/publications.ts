import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Publications — missions de diffusion planifiées pour un signal
 * (Discord, X, Bluesky, Mastodon, Payload CMS).
 */
export const publications: CollectionConfig = {
    slug: 'publications',
    labels: {
        singular: 'Publication',
        plural: 'Publications',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'platform',
        defaultColumns: ['platform', 'status', 'scheduled_at', 'published_at'],
        description: 'Missions de diffusion planifiées (réseaux sociaux + CMS).',
    },
    fields: [
        {
            name: 'signal',
            type: 'relationship',
            relationTo: 'signals',
            required: true,
            index: true,
            admin: {
                description: 'Signal associé à cette mission de publication.',
            },
        },
        {
            name: 'platform',
            type: 'text',
            required: true,
            admin: {
                description: 'Plateforme de destination (DISCORD, X, BLUESKY, MASTODON, PAYLOAD).',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'PENDING',
            options: [
                { label: 'En attente', value: 'PENDING' },
                { label: 'Publié', value: 'PUBLISHED' },
                { label: 'Échec', value: 'FAILED' },
            ],
            index: true,
        },
        {
            name: 'scheduled_at',
            type: 'date',
            required: true,
        },
        {
            name: 'published_at',
            type: 'date',
        },
    ],
};
