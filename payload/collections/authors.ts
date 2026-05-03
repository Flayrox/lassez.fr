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
    access: {
        read: () => true,
        create: ({ req: { user } }) => {
            if (!user) return false;
            if (user.roles?.includes('admin')) return true;
            return false;
        },
        update: ({ req: { user } }) => {
            if (!user) return false;
            if (user.roles?.includes('admin')) return true;
            return {
                id: {
                    equals: user.id,
                },
            };
        },
        delete: ({ req: { user } }) => {
            if (!user) return false;
            if (user.roles?.includes('admin')) return true;
            return false;
        },
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
            name: 'roles',
            type: 'select',
            hasMany: true,
            defaultValue: ['author'],
            required: true,
            options: [
                { label: 'Admin', value: 'admin' },
                { label: 'Éditeur', value: 'editor' },
                { label: 'Auteur', value: 'author' },
            ],
            access: {
                create: ({ req: { user } }) => user?.roles?.includes('admin'),
                update: ({ req: { user } }) => user?.roles?.includes('admin'),
            },
            admin: {
                description: 'Permissions de l’utilisateur. Seuls les admins peuvent modifier ce champ.',
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