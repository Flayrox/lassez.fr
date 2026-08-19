import type { GlobalConfig } from 'payload';
import { isAdmin } from '../access';

const GEMINI_MODEL_OPTIONS = [
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
];

export const settings: GlobalConfig = {
    slug: 'settings',
    access: {
        read: () => true, // Everyone can read settings
        update: isAdmin,
    },
    admin: {
        group: 'Site',
        description: 'Réglages globaux du site (Textes, Liens, Maintenance)',
    },
    fields: [
        {
            name: 'seoGeminiModel',
            type: 'select',
            defaultValue: 'gemini-3.1-pro-preview',
            options: GEMINI_MODEL_OPTIONS.map((model) => ({ label: model, value: model })),
            admin: {
                description: 'Modèle Gemini utilisé pour générer automatiquement les métadonnées SEO.',
            },
        },
        {
            name: 'displaySettings',
            type: 'group',
            label: 'Affichage & État',
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'flashInfoEnabled',
                            type: 'checkbox',
                            defaultValue: true,
                            label: 'Activer le Flash Info (Ticker)',
                        },
                        {
                            name: 'showHeader',
                            type: 'checkbox',
                            defaultValue: true,
                            label: 'Afficher le Header',
                        },
                        {
                            name: 'showFooter',
                            type: 'checkbox',
                            defaultValue: true,
                            label: 'Afficher le Footer',
                        },
                    ],
                },
            ],
        },
        {
            name: 'flashInfoText',
            type: 'text',
            admin: {
                description: 'Texte par défaut si la liste ci-dessous est vide.',
            },
        },
        {
            name: 'tickerItems',
            type: 'array',
            label: 'Messages du Flash Info',
            admin: {
                description: 'Liste des messages défilants. Si actif, ils apparaîtront dans le bandeau.',
            },
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'text',
                            type: 'text',
                            required: true,
                            admin: { width: '80%' },
                        },
                        {
                            name: 'active',
                            type: 'checkbox',
                            defaultValue: true,
                            admin: { width: '20%' },
                        },
                    ],
                },
            ],
        },
        {
            name: 'communication',
            type: 'group',
            label: 'Communication & État',
            admin: {
                description: 'Mode maintenance et popup d’information affichés au public (ex. table SQLite radar_settings).',
            },
            fields: [
                {
                    type: 'collapsible',
                    label: '🛠️ Mode maintenance',
                    admin: {
                        initCollapsed: false,
                    },
                    fields: [
                        {
                            name: 'maintenanceMode',
                            type: 'checkbox',
                            defaultValue: false,
                            label: 'Activer le mode maintenance',
                            admin: {
                                description: 'Remplace le site public par un écran « Maintenance en cours ». L’administration reste accessible pour le désactiver.',
                            },
                        },
                        {
                            name: 'maintenanceMessage',
                            type: 'textarea',
                            label: 'Message affiché',
                            admin: {
                                condition: (_data, siblingData) => siblingData?.maintenanceMode === true,
                                description: 'Texte affiché sous le titre. Laissé vide = message par défaut.',
                            },
                        },
                    ],
                },
                {
                    type: 'collapsible',
                    label: '✨ Popup d’information',
                    admin: {
                        initCollapsed: true,
                    },
                    fields: [
                        {
                            name: 'popupEnabled',
                            type: 'checkbox',
                            defaultValue: false,
                            label: 'Activer la popup',
                            admin: {
                                description: 'Affiche une popup promotionnelle / informative après le chargement du site (une seule fois par session).',
                            },
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'popupTitle',
                                    type: 'text',
                                    label: 'Titre',
                                    admin: {
                                        width: '50%',
                                        condition: (_data, siblingData) => siblingData?.popupEnabled === true,
                                    },
                                },
                                {
                                    name: 'popupLinkLabel',
                                    type: 'text',
                                    label: 'Libellé du bouton',
                                    admin: {
                                        width: '50%',
                                        condition: (_data, siblingData) => siblingData?.popupEnabled === true,
                                    },
                                },
                            ],
                        },
                        {
                            name: 'popupText',
                            type: 'textarea',
                            label: 'Texte',
                            admin: {
                                condition: (_data, siblingData) => siblingData?.popupEnabled === true,
                            },
                        },
                        {
                            name: 'popupLinkUrl',
                            type: 'text',
                            label: 'URL du bouton',
                            admin: {
                                condition: (_data, siblingData) => siblingData?.popupEnabled === true,
                                description: 'Chemin interne (ex. /soutenir) ou URL externe complète.',
                            },
                        },
                    ],
                },
            ],
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
                {
                    name: 'bluesky',
                    type: 'text',
                },
                {
                    name: 'mastodon',
                    type: 'text',
                },
                {
                    name: 'tiktok',
                    type: 'text',
                },
                {
                    name: 'linkedin',
                    type: 'text',
                },
            ],
        },
        {
            name: 'matomoSettings',
            type: 'group',
            fields: [
                {
                    name: 'matomoId',
                    type: 'text',
                    defaultValue: '1',
                },
                {
                    name: 'matomoUrl',
                    type: 'text',
                    defaultValue: 'https://stats.lassez.fr/',
                },
            ],
            admin: {
                description: 'Réglages Matomo pour les statistiques de visite.',
            },
        },
        {
            name: 'manifest',
            type: 'group',
            label: 'Manifest & PWA',
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'siteName',
                            type: 'text',
                            defaultValue: "L'Assez",
                            required: true,
                        },
                        {
                            name: 'shortName',
                            type: 'text',
                            defaultValue: "L'Assez",
                        },
                    ],
                },
                {
                    name: 'description',
                    type: 'textarea',
                    defaultValue: "Journalisme d'investigation indépendant.",
                },
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'themeColor',
                            type: 'text',
                            defaultValue: '#ff0000',
                        },
                        {
                            name: 'backgroundColor',
                            type: 'text',
                            defaultValue: '#ffffff',
                        },
                    ],
                },
            ],
            admin: {
                description: 'Configuration du manifest Web (PWA).',
            },
        },
        {
            name: 'navigation',
            type: 'array',
            label: 'Menu de Navigation',
            admin: {
                description: 'Configurez les liens du menu principal dans le header.',
            },
            fields: [
                {
                    type: 'row',
                    fields: [
                        {
                            name: 'label',
                            type: 'text',
                            required: true,
                            admin: { width: '40%' },
                        },
                        {
                            name: 'enabled',
                            type: 'checkbox',
                            defaultValue: true,
                            admin: { width: '20%' },
                        },
                        {
                            name: 'badge',
                            type: 'text',
                            admin: { width: '20%' },
                        },
                    ],
                },
                {
                    name: 'linkType',
                    type: 'select',
                    defaultValue: 'custom',
                    options: [
                        { label: 'Lien Personnalisé', value: 'custom' },
                        { label: 'Catégorie', value: 'category' },
                    ],
                },
                {
                    name: 'customUrl',
                    type: 'text',
                    admin: {
                        condition: (data, siblingData) => siblingData?.linkType === 'custom',
                    },
                },
                {
                    name: 'category',
                    type: 'relationship',
                    relationTo: 'categories',
                    admin: {
                        condition: (data, siblingData) => siblingData?.linkType === 'category',
                    },
                },
            ],
        },
    ],
};
