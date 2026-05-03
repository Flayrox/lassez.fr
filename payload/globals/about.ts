import type { GlobalConfig } from 'payload';
import { isEditor } from '../access';

export const about: GlobalConfig = {
    slug: 'about',
    access: {
        read: () => true,
        update: isEditor,
    },
    admin: {
        description: 'Éditez le Manifeste et la présentation de l’équipe.',
    },
    fields: [
        {
            name: 'title',
            type: 'text',
            defaultValue: 'Le Manifeste',
            required: true,
        },
        {
            name: 'version',
            type: 'text',
            defaultValue: 'Document Fondateur v.1.0',
        },
        {
            name: 'introText',
            type: 'textarea',
            defaultValue: "L'Assez est né d'un constat simple : l'information dominante sert les intérêts d'une élite déconnectée des réalités des classes populaires. Les magouilles gouvernementales, les dérives autoritaires et les inégalités cachées sont trop souvent passées sous silence.",
            required: true,
        },
        {
            name: 'manifestoSections',
            type: 'array',
            label: 'Sections du Manifeste',
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
                    name: 'variant',
                    type: 'select',
                    defaultValue: 'red',
                    options: [
                        { label: 'Bordure Rouge', value: 'red' },
                        { label: 'Bordure Noire', value: 'black' },
                    ],
                },
            ],
        },
        {
            name: 'quote',
            type: 'text',
            defaultValue: '"L’avenir est antifasciste."',
            admin: {
                description: 'Citation mise en avant (bloc jaune).',
            },
        },
        {
            name: 'signature',
            type: 'group',
            fields: [
                { name: 'line1', type: 'text', defaultValue: "Rédigé par le Collectif L'Assez." },
                { name: 'line2', type: 'text', defaultValue: 'Paris, France.' },
            ],
        },
        {
            name: 'team',
            type: 'array',
            label: 'Le Noyau Dur (Équipe)',
            fields: [
                {
                    name: 'name',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'role',
                    type: 'text',
                    required: true,
                },
                {
                    name: 'avatar',
                    type: 'upload',
                    relationTo: 'media',
                },
            ],
        },
    ],
};
