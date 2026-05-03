import type { CollectionConfig } from 'payload';
import { isAuthor, isEditor, publicRead } from '../access';
import { slugifyEditorialValue } from '../lib/editorial';

async function ensureTagSlug({ data, originalDoc }: any) {
    const nextData = { ...(data || {}) };
    if (!nextData.slug && (nextData.name || originalDoc?.name)) {
        nextData.slug = slugifyEditorialValue(nextData.name || originalDoc?.name);
    }
    return nextData;
}

export const tags = {
    slug: 'tags',
    access: {
        read: publicRead,
        create: isAuthor,
        update: isEditor,
        delete: isEditor,
    },
    admin: {
        useAsTitle: 'name',
        description: 'Étiquettes utilisées dans les dossiers et le flux éditorial.',
    },
    hooks: {
        beforeValidate: [ensureTagSlug],
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            admin: {
                description: 'Nom affiché de l’étiquette.',
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
    ],
} satisfies CollectionConfig;