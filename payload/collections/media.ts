import type { CollectionConfig } from 'payload';
import { isAuthenticated, publicRead } from '../access';

export const media = {
    slug: 'media',
    access: {
        read: publicRead,
        create: isAuthenticated,
        update: isAuthenticated,
        delete: isAuthenticated,
    },
    upload: {
        staticDir: 'media',
    },
    fields: [
        { name: 'alt', type: 'text' },
        { name: 'caption', type: 'textarea' },
        { name: 'credit', type: 'text' },
    ],
} satisfies CollectionConfig;