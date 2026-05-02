import type { GlobalConfig } from 'payload';
import { isAuthenticated } from '../access';

export const legal: GlobalConfig = {
    slug: 'legal',
    label: 'Mentions Légales',
    access: {
        read: () => true,
        update: isAuthenticated,
    },
    admin: {
        description: 'Éditez les informations légales et la politique de confidentialité.',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            defaultValue: 'Mentions Légales',
            required: true,
        },
        {
            name: 'lastUpdated',
            type: 'text',
            defaultValue: 'Mises à jour annuellement.',
        },
        {
            name: 'sections',
            type: 'array',
            label: 'Sections Légales',
            fields: [
                {
                    name: 'title',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'content',
                    type: 'richText',
                    required: true,
                },
                {
                    name: 'highlightBox',
                    type: 'richText',
                    label: 'Encadré de mise en avant (Optionnel)',
                },
            ],
        },
    ],
};
