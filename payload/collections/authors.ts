import type { CollectionConfig } from 'payload';

export const authors = {
    slug: 'authors',
    auth: true,
    admin: {
        useAsTitle: 'name',
        description: 'Auteurs et comptes éditoriaux du média.',
    },
    fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true, unique: true },
        { name: 'bio', type: 'textarea' },
        { name: 'avatar', type: 'upload', relationTo: 'media' },
    ],
} satisfies CollectionConfig;