import type { CollectionConfig } from 'payload';
import { isAuthenticated, publicRead } from '../access';

export const categories = {
    slug: 'categories',
    access: {
        read: publicRead,
        create: isAuthenticated,
        update: isAuthenticated,
        delete: isAuthenticated,
    },
    admin: {
        useAsTitle: 'name',
        description: 'Taxonomie éditoriale principale du front.',
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