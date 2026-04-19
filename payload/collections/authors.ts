import type { CollectionConfig } from 'payload';
import { slugifyEditorialValue } from '../lib/editorial';

async function ensureAuthorSlug({ data, originalDoc }: any) {
    const nextData = { ...(data || {}) };
    if (!nextData.slug && (nextData.name || originalDoc?.name)) {
        nextData.slug = slugifyEditorialValue(nextData.name || originalDoc?.name);
    }
    return nextData;
}

export const authors = {
    slug: 'authors',
    auth: true,
    admin: {
        useAsTitle: 'name',
        description: 'Auteurs et comptes éditoriaux du média.',
    },
    hooks: {
        beforeValidate: [ensureAuthorSlug],
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Nom public ou signature éditoriale.',
            },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'Slug auto-généré à partir du nom si vide.',
            },
        },
        { name: 'bio', type: 'textarea' },
        { name: 'avatar', type: 'upload', relationTo: 'media' },
    ],
} satisfies CollectionConfig;