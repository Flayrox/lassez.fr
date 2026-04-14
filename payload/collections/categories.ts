import type { CollectionConfig } from 'payload';

export const categories = {
    slug: 'categories',
    admin: {
        useAsTitle: 'name',
    },
    fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true, unique: true },
        { name: 'description', type: 'textarea' },
        { name: 'seoTitle', type: 'text' },
        { name: 'seoDescription', type: 'textarea' },
        { name: 'sortOrder', type: 'number', defaultValue: 0 },
        { name: 'enabled', type: 'checkbox', defaultValue: true },
    ],
} satisfies CollectionConfig;