import type { GlobalConfig } from 'payload';
import { isAuthenticated } from '../access';

export const settings: GlobalConfig = {
    slug: 'settings',
    access: {
        read: () => true, // Everyone can read settings
        update: isAuthenticated,
    },
    admin: {
        description: 'Réglages globaux du site (Textes, Liens, Maintenance)',
    },
    fields: [
        {
            name: 'flashInfoText',
            type: 'text',
            admin: {
                description: 'Texte affiché dans le Flash Info Ticker.',
            },
        },
        {
            name: 'maintenanceMode',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Activer le mode maintenance au public.',
            },
        },
        {
            name: 'socialLinks',
            type: 'group',
            fields: [
                {
                    name: 'twitter',
                    type: 'text',
                },
                {
                    name: 'telegram',
                    type: 'text',
                },
                {
                    name: 'instagram',
                    type: 'text',
                },
            ],
        },
    ],
};
