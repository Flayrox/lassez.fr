import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Taxonomy Templates — formats éditoriaux (FLASH, CITATION, ALERTE, …)
 * utilisés par le Researcher et l'Editorialist pour calibrer les prompts IA.
 */
export const taxonomyTemplates: CollectionConfig = {
    slug: 'taxonomy-templates',
    labels: {
        singular: 'Template de taxonomie',
        plural: 'Templates de taxonomie',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Radar',
        useAsTitle: 'name',
        defaultColumns: ['name', 'display_name', 'active', 'sort_order'],
        description: 'Formats éditoriaux (FLASH, CITATION, ALERTE…) pour les prompts IA.',
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
            admin: {
                description: 'Section de prompt spécifique à ce format.',
            },
        },
        {
            name: 'examples_json',
            type: 'json',
            admin: {
                description: 'Tableau JSON d’exemples de sortie.',
            },
        },
        {
            name: 'output_schema_json',
            type: 'json',
            admin: {
                description: 'Structure JSON attendue en sortie.',
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
        },
        {
            name: 'sort_order',
            type: 'number',
            defaultValue: 0,
        },
    ],
};
