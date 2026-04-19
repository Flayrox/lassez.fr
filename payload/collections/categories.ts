import type { CollectionConfig } from 'payload';
import { isAuthenticated, publicRead } from '../access';
import { slugifyEditorialValue } from '../lib/editorial';

async function ensureCategorySlug({ data, originalDoc }: any) {
    const nextData = { ...(data || {}) };
    if (!nextData.slug && (nextData.name || originalDoc?.name)) {
        nextData.slug = slugifyEditorialValue(nextData.name || originalDoc?.name);
    }
    return nextData;
}

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
    hooks: {
        beforeValidate: [ensureCategorySlug],
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Nom affiché de la catégorie.',
            },
        },
        {
            name: 'slug',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'Slug auto-généré à partir du nom si besoin.',
            },
        },
        {
            name: 'description',
            type: 'textarea',
            admin: {
                description: 'Texte éditorial optionnel affiché sur les pages catégorie.',
            },
        },
        { name: 'seoTitle', type: 'text' },
        { name: 'seoDescription', type: 'textarea' },
        { name: 'sortOrder', type: 'number', defaultValue: 0 },
        { name: 'enabled', type: 'checkbox', defaultValue: true },
    ],
} satisfies CollectionConfig;