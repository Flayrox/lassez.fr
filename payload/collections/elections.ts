import type { CollectionConfig } from 'payload';
import { isAdmin, isEditor } from '../access';

/**
 * Élections — couverture temps réel des scrutins (ex tables legacy SQLite :
 * elections_registry, election_sources, election_daemon_config,
 * election_front_display). Une entrée = un scrutin.
 *
 * UX : 4 onglets lisibles — identité, sources data.gouv, daemon, affichage front.
 */
export const elections: CollectionConfig = {
    slug: 'elections',
    access: {
        read: isEditor,
        create: isEditor,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Investigation',
        useAsTitle: 'label',
        defaultColumns: ['label', 'slug', 'category', 'status', 'is_visible', 'updatedAt'],
        description: 'Scrutins suivis par la veille : sources data.gouv, daemon et affichage sur le site.',
        components: {
            // Bouton « Nouvelle élection » (import rapide) au-dessus de la liste.
            beforeListTable: ['/payload/components/CreateElectionButton'],
        },
    },
    fields: [
        {
            type: 'tabs',
            tabs: [
                {
                    label: 'Général',
                    fields: [
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'label',
                                    type: 'text',
                                    required: true,
                                    label: 'Nom du scrutin',
                                    admin: { width: '50%', description: 'Ex. « Municipales 2026 ».' },
                                },
                                {
                                    name: 'slug',
                                    type: 'text',
                                    required: true,
                                    unique: true,
                                    label: 'Slug',
                                    admin: { width: '50%', description: 'Identifiant URL unique, ex. « municipales-2026 ».' },
                                },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'category',
                                    type: 'select',
                                    required: true,
                                    defaultValue: 'municipales',
                                    label: 'Catégorie',
                                    options: [
                                        { label: 'Municipales', value: 'municipales' },
                                        { label: 'Présidentielles', value: 'presidentielles' },
                                        { label: 'Législatives', value: 'legislatives' },
                                        { label: 'Européennes', value: 'europeennes' },
                                        { label: 'Régionales', value: 'regionales' },
                                        { label: 'Départementales', value: 'departementales' },
                                        { label: 'Référendum', value: 'referendum' },
                                        { label: 'Autre', value: 'autre' },
                                    ],
                                    admin: { width: '50%' },
                                },
                                {
                                    name: 'status',
                                    type: 'select',
                                    required: true,
                                    defaultValue: 'draft',
                                    label: 'Statut',
                                    options: [
                                        { label: 'Brouillon', value: 'draft' },
                                        { label: 'Actif', value: 'active' },
                                        { label: 'Terminé', value: 'done' },
                                    ],
                                    admin: { width: '50%', description: '« Actif » = couverture en cours.' },
                                },
                            ],
                        },
                    ],
                },
                {
                    label: 'Sources data.gouv',
                    fields: [
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'source_type',
                                    type: 'select',
                                    defaultValue: 'dataset-api',
                                    label: 'Type de source',
                                    options: [
                                        { label: 'API data.gouv (dataset)', value: 'dataset-api' },
                                        { label: 'Scraping manuel', value: 'manual' },
                                    ],
                                    admin: { width: '50%' },
                                },
                                {
                                    name: 'parser_strategy',
                                    type: 'text',
                                    label: 'Stratégie de parsing',
                                    admin: { width: '50%', description: 'Ex. « municipales-communes-v1 ».' },
                                },
                            ],
                        },
                        {
                            name: 'datasets',
                            type: 'array',
                            label: 'Jeux de données',
                            minRows: 0,
                            admin: {
                                description: 'Slugs des datasets data.gouv à importer (résultats et candidatures, par tour).',
                            },
                            fields: [
                                {
                                    type: 'row',
                                    fields: [
                                        {
                                            name: 'role',
                                            type: 'select',
                                            required: true,
                                            label: 'Rôle',
                                            options: [
                                                { label: 'Résultats — 1er tour', value: 'results_first_tour' },
                                                { label: 'Résultats — 2nd tour', value: 'results_second_tour' },
                                                { label: 'Candidatures — 1er tour', value: 'candidates_first_tour' },
                                                { label: 'Candidatures — 2nd tour', value: 'candidates_second_tour' },
                                            ],
                                            admin: { width: '40%' },
                                        },
                                        {
                                            name: 'dataset_slug',
                                            type: 'text',
                                            required: true,
                                            label: 'Slug du dataset',
                                            admin: { width: '60%', description: 'Ex. « elections-municipales-2026-resultats-du-premier-tour ».' },
                                        },
                                    ],
                                },
                                {
                                    name: 'last_url',
                                    type: 'text',
                                    label: 'Dernière URL importée',
                                    admin: { description: 'URL complète du dernier fichier importé (remplie automatiquement).' },
                                },
                                {
                                    name: 'last_success',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Dernier import réussi',
                                },
                                {
                                    name: 'last_error',
                                    type: 'text',
                                    label: 'Erreur du dernier import',
                                },
                            ],
                        },
                    ],
                },
                {
                    label: 'Daemon',
                    fields: [
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'daemon_enabled',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Daemon activé',
                                    admin: { width: '33%' },
                                },
                                {
                                    name: 'live_mode_enabled',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Mode live',
                                    admin: { width: '33%' },
                                },
                                {
                                    name: 'sync_locked',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Synchronisation verrouillée',
                                    admin: { width: '33%' },
                                },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'interval_enabled',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Intervalle activé',
                                    admin: { width: '33%' },
                                },
                                {
                                    name: 'interval_hours',
                                    type: 'number',
                                    defaultValue: 0.5,
                                    label: 'Intervalle (heures)',
                                    admin: { width: '33%' },
                                },
                                {
                                    name: 'poll_interval_minutes',
                                    type: 'number',
                                    defaultValue: 2,
                                    label: 'Poll (minutes)',
                                    admin: { width: '33%' },
                                },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'schedule_enabled',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Planification activée',
                                    admin: { width: '33%' },
                                },
                                {
                                    name: 'schedule_times',
                                    type: 'text',
                                    label: 'Horaires planifiés',
                                    admin: { width: '67%', description: 'Ex. « 08:00, 18:00 ».' },
                                },
                            ],
                        },
                    ],
                },
                {
                    label: 'Affichage front',
                    fields: [
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'is_visible',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Visible sur le front',
                                    admin: { width: '33%' },
                                },
                                {
                                    name: 'is_featured',
                                    type: 'checkbox',
                                    defaultValue: false,
                                    label: 'Mis en avant',
                                    admin: { width: '33%' },
                                },
                                {
                                    name: 'display_order',
                                    type: 'number',
                                    defaultValue: 1,
                                    label: 'Ordre d’affichage',
                                    admin: { width: '33%' },
                                },
                            ],
                        },
                        {
                            name: 'hide_after_date',
                            type: 'date',
                            label: 'Masquer après cette date',
                            admin: { description: 'Optionnel : l’élection disparaît du front après cette date.' },
                        },
                    ],
                },
            ],
        },
    ],
};
