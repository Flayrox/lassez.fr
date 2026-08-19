import type { CollectionConfig } from 'payload';
import { isAdmin } from '../access';

/**
 * Logs — journal d'exécution du daemon Radar (nœuds, niveaux, timestamps).
 * Utilisé notamment pour le heartbeat de l'interface (dernier log).
 */
export const logs: CollectionConfig = {
    slug: 'logs',
    labels: {
        singular: 'Entrée de journal',
        plural: 'Journal d’activité',
    },
    access: {
        read: isAdmin,
        create: isAdmin,
        update: isAdmin,
        delete: isAdmin,
    },
    admin: {
        group: 'Investigation',
        useAsTitle: 'message',
        defaultColumns: ['level', 'node_id', 'message', 'timestamp'],
        listSearchableFields: ['message', 'node_id', 'level'],
        description: 'Journal d’activité de la veille (nœuds, erreurs, succès).',
    },
    fields: [
        {
            name: 'level',
            type: 'select',
            required: true,
            defaultValue: 'INFO',
            label: 'Niveau',
            options: [
                { label: 'Info', value: 'INFO' },
                { label: 'Attention', value: 'WARN' },
                { label: 'Erreur', value: 'ERROR' },
                { label: 'Succès', value: 'SUCCESS' },
            ],
            index: true,
            admin: {
                components: {
                    Cell: '/payload/components/StatusCell',
                },
            },
        },
        {
            name: 'message',
            type: 'textarea',
            required: true,
        },
        {
            name: 'node_id',
            type: 'text',
            label: 'Nœud émetteur',
            admin: {
                description: 'Étape du pipeline émettrice (Node 1, Node 2, Daemon, SYSTEM…).',
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
