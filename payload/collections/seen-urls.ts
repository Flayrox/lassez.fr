import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Seen URLs — historique des URL déjà ingérées pour le dédoublonnage absolu.
 * Table à volume élevé : aucune version, index sur createdAt pour les purges.
 */
export const seenUrls: CollectionConfig = {
    slug: 'seen-urls',
    labels: {
        singular: 'URL déjà vue',
        plural: 'URLs déjà vues',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Investigation',
        useAsTitle: 'url',
        defaultColumns: ['url', 'createdAt'],
        listSearchableFields: ['url'],
        description: 'Mémoire des articles déjà vus (évite les doublons).',
    },
    fields: [
        {
            name: 'url',
            type: 'text',
            required: true,
            unique: true,
            index: true,
            label: 'Adresse de l’article',
        },
    ],
};
