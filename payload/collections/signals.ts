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
        singular: 'Signal',
        plural: 'Signals',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'source_title',
        defaultColumns: ['status', 'taxonomy', 'geo', 'updatedAt'],
        description: 'Sujets traités par le pipeline Radar (ingestion → publication).',
    },
    fields: [
        {
            name: 'source_title',
            type: 'text',
            admin: {
                description: 'Titre du sujet (extrait du raw_data au premier accès).',
            },
        },
        {
            name: 'raw_data',
            type: 'json',
            admin: {
                description: 'Payload d’entrée du pipeline (cluster, articles agrégés, sources).',
            },
        },
        {
            name: 'final_draft',
            type: 'json',
            admin: {
                description: 'Payload de sortie éditorial (headline, body, image_keyword).',
            },
        },
        {
            name: 'status',
            type: 'select',
            required: true,
            defaultValue: 'INGESTED',
            options: SIGNAL_STATUSES.map((s) => ({ label: s, value: s })),
            index: true,
        },
        {
            name: 'taxonomy',
            type: 'text',
            admin: {
                description: 'Catégorie éditoriale (INFO, DÉCRYPTAGE, ALERTE, …).',
            },
        },
        {
            name: 'tags',
            type: 'json',
            admin: {
                description: 'Tableau JSON des mots-clés.',
            },
        },
        {
            name: 'geo',
            type: 'text',
            admin: {
                description: 'Zone géographique (FRANCE, INTERNATIONAL, …).',
            },
        },
        {
            name: 'image_url',
            type: 'text',
        },
        {
            name: 'scheduled_at',
            type: 'date',
            admin: {
                description: 'Moment où la file de publication doit traiter ce signal.',
            },
        },
        {
            name: 'published_at',
            type: 'date',
            admin: {
                description: 'Date exacte de publication finale.',
            },
        },
    ],
};
