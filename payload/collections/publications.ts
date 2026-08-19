import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Publications — missions de diffusion planifiées pour un signal
 * (Discord, X, Bluesky, Mastodon, Payload CMS).
 */
export const publications: CollectionConfig = {
    slug: 'publications',
    labels: {
        singular: 'Diffusion',
        plural: 'Diffusions',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Investigation',
        useAsTitle: 'platform',
        defaultColumns: ['platform', 'status', 'scheduled_at', 'updatedAt'],
        listSearchableFields: ['platform', 'status'],
        description: 'Diffusions planifiées d’un sujet (réseaux sociaux + CMS).',
    },
    fields: [
        {
            name: 'signal',
            type: 'relationship',
            relationTo: 'signals',
            required: true,
            index: true,
            label: 'Sujet associé',
            admin: {
                description: 'Sujet diffusé par cette mission.',
            },
        },
        {
            name: 'platform',
            type: 'select',
            required: true,
            label: 'Plateforme',
            options: [
                { label: 'Discord', value: 'DISCORD' },
                { label: 'X / Twitter', value: 'X' },
                { label: 'Bluesky', value: 'BLUESKY' },
                { label: 'Mastodon', value: 'MASTODON' },
                { label: 'Payload CMS (révélation)', value: 'PAYLOAD' },
            ],
            index: true,
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
            admin: {
                components: {
                    Cell: '/payload/components/StatusCell',
                },
            },
        },
        {
            name: 'scheduled_at',
            type: 'date',
            required: true,
            label: 'Diffusion prévue le',
        },
        {
            name: 'published_at',
            type: 'date',
            label: 'Diffusé le',
        },
    ],
};
