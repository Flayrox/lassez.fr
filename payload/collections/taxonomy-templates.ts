import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Taxonomy Templates — formats éditoriaux (FLASH, CITATION, ALERTE, …)
 * utilisés par le Researcher et l'Editorialist pour calibrer les prompts IA.
 */
export const taxonomyTemplates: CollectionConfig = {
    slug: 'taxonomy-templates',
    labels: {
        singular: 'Format éditorial',
        plural: 'Formats éditoriaux',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Investigation',
        useAsTitle: 'name',
        defaultColumns: ['name', 'display_name', 'active', 'sort_order'],
        listSearchableFields: ['name', 'display_name', 'description'],
        description: 'Formats éditoriaux (FLASH, CITATION, ALERTE…) pour la rédaction IA.',
    },
    fields: [
        {
            name: 'name',
            type: 'text',
            required: true,
            unique: true,
            admin: {
                description: 'Identifiant technique (FLASH, CITATION, ALERTE…).',
            },
        },
        {
            name: 'display_name',
            type: 'text',
            admin: {
                description: 'Nom affiché (🚨 FLASH, ⚡️ CITATION…).',
            },
        },
        {
            name: 'description',
            type: 'textarea',
        },
        {
            name: 'format_instructions',
            type: 'textarea',
            label: 'Consignes de rédaction',
            admin: {
                description: 'Le prompt complet de ce format (tout le texte, avec les retours à la ligne).',
                rows: 12,
            },
        },
        {
            name: 'examples',
            type: 'array',
            label: 'Exemples de sortie',
            labels: {
                singular: 'Exemple',
                plural: 'Exemples',
            },
            admin: {
                description: 'Un exemple par ligne — chaque exemple est éditable et supprimable individuellement.',
            },
            fields: [
                {
                    name: 'example',
                    type: 'textarea',
                    label: 'Contenu de l’exemple',
                    required: true,
                    admin: {
                        rows: 5,
                    },
                },
            ],
        },
        {
            name: 'output_schema_json',
            type: 'code',
            label: 'Schéma de sortie (JSON)',
            admin: {
                language: 'json',
                description: 'Structure JSON que la rédaction IA doit produire pour ce format.',
            },
        },
        {
            name: 'accent_color',
            type: 'text',
            defaultValue: '#000000',
            admin: {
                description: 'Couleur d’accentuation dans l’interface.',
            },
        },
        {
            name: 'is_factory',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Template d’usine : réinitialisable mais non supprimable.',
            },
        },
        {
            name: 'active',
            type: 'checkbox',
            defaultValue: true,
            index: true,
            label: 'Format actif',
        },
        {
            name: 'sort_order',
            type: 'number',
            defaultValue: 0,
        },
    ],
};
