import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

export const SIGNAL_STATUSES = [
    'INGESTED',
    'RESEARCHED',
    'DRAFTED',
    'VALIDATED',
    'PENDING',
    'QUEUED',
    'PUBLISHED',
    'REJECTED',
    'REJECTED_ERROR',
    'FAILED',
] as const;

/**
 * Signals — les sujets traités par le pipeline Radar (ex NewsTopic).
 *
 * C'est la source de vérité du daemon : ingestion → dedup → research → editorial
 * → validation → media → publication. Chaque nœud fait évoluer `status`.
 */
export const signals: CollectionConfig = {
    slug: 'signals',
    labels: {
        singular: 'Sujet',
        plural: 'Sujets',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Investigation',
        useAsTitle: 'source_title',
        defaultColumns: ['status', 'source_title', 'taxonomy', 'geo', 'actions', 'updatedAt'],
        listSearchableFields: ['source_title', 'taxonomy', 'geo'],
        description: 'Sujets détectés et suivis par la veille (ingestion → publication en révélation).',
    },
    fields: [
        {
            name: 'source_title',
            type: 'text',
            label: 'Titre du sujet',
            admin: {
                description: 'Titre du sujet (extrait des articles sources au premier accès).',
            },
        },
        {
            name: 'raw_data',
            type: 'json',
            admin: {
                description: 'Données brutes d’entrée (articles agrégés, sources, cluster).',
            },
        },
        {
            name: 'final_draft',
            type: 'json',
            admin: {
                description: 'Sortie éditoriale (titre, corps, mots-clés d’image).',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'INGESTED',
            options: [
                { label: 'Détecté', value: 'INGESTED' },
                { label: 'Analysé', value: 'RESEARCHED' },
                { label: 'Rédigé', value: 'DRAFTED' },
                { label: 'Validé', value: 'VALIDATED' },
                { label: 'En attente de diffusion', value: 'PENDING' },
                { label: 'En file', value: 'QUEUED' },
                { label: 'Publié', value: 'PUBLISHED' },
                { label: 'Rejeté', value: 'REJECTED' },
                { label: 'Erreur de rejet', value: 'REJECTED_ERROR' },
                { label: 'Échec', value: 'FAILED' },
            ],
            index: true,
            admin: {
                components: {
                    Cell: '/payload/components/StatusCell',
                },
            },
        },
        {
            name: 'taxonomy',
            type: 'text',
            label: 'Catégorie',
            admin: {
                description: 'Catégorie éditoriale (INFO, DÉCRYPTAGE, ALERTE, …).',
            },
        },
        {
            name: 'tags',
            type: 'json',
            label: 'Mots-clés',
            admin: {
                description: 'Liste des mots-clés associés au sujet.',
            },
        },
        {
            name: 'geo',
            type: 'text',
            label: 'Zone géographique',
            admin: {
                description: 'Zone géographique (FRANCE, INTERNATIONAL, …).',
            },
        },
        {
            name: 'image_url',
            type: 'text',
            label: 'Visuel (URL)',
            admin: {
                description: 'Visuel du sujet (généré par le bouton 🖼 Visuel ou choisi manuellement).',
            },
        },
        {
            name: 'scheduled_at',
            type: 'date',
            label: 'Diffusion planifiée le',
            admin: {
                description: 'Moment où la file de publication doit traiter ce sujet.',
            },
        },
        {
            name: 'published_at',
            type: 'date',
            label: 'Publié le',
            admin: {
                description: 'Date exacte de publication finale.',
            },
        },
        {
            name: 'actions',
            type: 'ui',
            label: 'Actions',
            admin: {
                components: {
                    Cell: '/payload/components/SignalActionsCell',
                },
            },
        },
        {
            name: 'revelation',
            type: 'relationship',
            relationTo: 'revelations',
            admin: {
                position: 'sidebar',
                description: 'Révélation publiée sur le site, générée depuis ce signal (rempli automatiquement par le daemon).',
            },
        },
    ],
};
