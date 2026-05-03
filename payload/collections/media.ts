import type { CollectionConfig } from 'payload';
import { isAuthor, publicRead } from '../access';

export const media = {
    slug: 'media',
    access: {
        read: publicRead,
        create: isAuthor,
        update: isAuthor,
        delete: isAuthor,
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