import type { CollectionConfig } from 'payload';

export const media = {
    slug: 'media',
    upload: {
        staticDir: 'media',
    },
    fields: [
        { name: 'alt', type: 'text' },
        { name: 'caption', type: 'textarea' },
        { name: 'credit', type: 'text' },
    ],
} satisfies CollectionConfig;