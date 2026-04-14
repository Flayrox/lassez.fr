import type { CollectionConfig } from 'payload';

export const tags = {
    slug: 'tags',
    admin: {
        useAsTitle: 'name',
    },
    fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true, unique: true },
    ],
} satisfies CollectionConfig;