import type { CollectionConfig } from 'payload';
import { isAuthenticated, publicRead } from '../access';

export const tags = {
    slug: 'tags',
    access: {
        read: publicRead,
        create: isAuthenticated,
        update: isAuthenticated,
        delete: isAuthenticated,
    },
    admin: {
        useAsTitle: 'name',
        description: 'Étiquettes utilisées dans les dossiers et le flux éditorial.',
    },
    fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true, unique: true },
    ],
} satisfies CollectionConfig;