import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Logs — journal d'exécution du daemon Radar (nœuds, niveaux, timestamps).
 * Utilisé notamment pour le heartbeat de l'interface (dernier log).
 */
export const logs: CollectionConfig = {
    slug: 'logs',
    labels: {
        singular: 'Log',
        plural: 'Logs',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        useAsTitle: 'message',
        defaultColumns: ['level', 'node_id', 'message', 'timestamp'],
        description: 'Journal d’exécution du daemon Radar.',
    },
    fields: [
        {
            name: 'level',
            type: 'select',
            required: true,
            defaultValue: 'INFO',
            options: [
                { label: 'INFO', value: 'INFO' },
                { label: 'WARN', value: 'WARN' },
                { label: 'ERROR', value: 'ERROR' },
                { label: 'SUCCESS', value: 'SUCCESS' },
            ],
            index: true,
        },
        {
            name: 'message',
            type: 'textarea',
            required: true,
        },
        {
            name: 'node_id',
            type: 'text',
            admin: {
                description: 'Nœud émetteur (Node 1, Node 2, Daemon, SYSTEM…).',
            },
        },
        {
            name: 'timestamp',
            type: 'date',
            required: true,
            defaultValue: () => new Date(),
            index: true,
        },
    ],
};
