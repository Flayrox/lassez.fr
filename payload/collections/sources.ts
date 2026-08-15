import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Sources — flux RSS, chaînes Telegram et requêtes Google News configurés
 * pour l'ingestion du daemon (ex table Prisma `Source` + radar_source_health).
 */
export const sources: CollectionConfig = {
    slug: 'sources',
    labels: {
        singular: 'Source',
        plural: 'Sources',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Radar',
        useAsTitle: 'source_name',
        defaultColumns: ['source_name', 'type', 'source_bias', 'active', 'health_status'],
        description: 'Flux et canaux ingérés par le daemon Radar.',
    },
    fields: [
        {
            name: 'url',
            type: 'text',
            required: true,
            unique: true,
            index: true,
        },
        {
            name: 'type',
            type: 'select',
            required: true,
            options: [
                { label: 'RSS', value: 'RSS' },
                { label: 'Telegram', value: 'TELEGRAM' },
                { label: 'Google News', value: 'GOOGLE_NEWS' },
            ],
        },
        {
            name: 'source_name',
            type: 'text',
            required: true,
        },
        {
            name: 'source_bias',
            type: 'text',
            defaultValue: 'Indépendant',
            admin: {
                description: 'Orientation éditoriale perçue (Droite, Gauche, Service Public, …).',
            },
        },
        {
            name: 'trust_score',
            type: 'number',
            required: true,
            defaultValue: 5,
            min: 1,
            max: 10,
        },
        {
            name: 'allow_source_images',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Autoriser l’usage des images de cette source dans les visuels.',
            },
        },
        {
            name: 'active',
            type: 'checkbox',
            defaultValue: true,
            index: true,
        },
        {
            name: 'health_status',
            type: 'select',
            defaultValue: 'OK',
            options: [
                { label: 'OK', value: 'OK' },
                { label: 'ERROR', value: 'ERROR' },
                { label: 'TIMEOUT', value: 'TIMEOUT' },
            ],
            admin: {
                description: 'État de santé du dernier scan (ex radar_source_health).',
            },
        },
        {
            name: 'last_check_at',
            type: 'date',
        },
        {
            name: 'error_message',
            type: 'textarea',
        },
        {
            name: 'response_time',
            type: 'number',
            admin: {
                description: 'Temps de réponse du dernier scan, en millisecondes.',
            },
        },
    ],
};
