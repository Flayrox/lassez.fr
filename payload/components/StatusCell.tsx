'use client';

import React from 'react';

/**
 * Cellule de liste générique : rend une valeur (statut de signal, niveau de
 * log, santé de source, statut de publication…) sous forme de badge coloré,
 * bien plus lisible qu'un texte brut dans les listes Payload.
 *
 * À brancher via `admin.components.cell` sur un champ select.
 */
const LABELS: Record<string, string> = {
    // Signals (sujets)
    INGESTED: 'Détecté',
    RESEARCHED: 'Analysé',
    DRAFTED: 'Rédigé',
    VALIDATED: 'Validé',
    PENDING: 'En attente',
    QUEUED: 'En file',
    PUBLISHED: 'Publié',
    REJECTED: 'Rejeté',
    REJECTED_ERROR: 'Erreur de rejet',
    FAILED: 'Échec',
    // Logs
    INFO: 'Info',
    WARN: 'Attention',
    ERROR: 'Erreur',
    SUCCESS: 'Succès',
    // Diffusions
    PUBLISHING: 'En cours',
    // Sources
    OK: 'OK',
    TIMEOUT: 'Délai dépassé',
};

export default function StatusCell({ cellData }: { cellData?: string | null }) {
    const raw = cellData == null || cellData === '' ? '—' : String(cellData);
    const value = raw.toUpperCase();
    const label = LABELS[value] ?? raw;

    const COLORS: Record<string, string> = {
        // Signals
        INGESTED: '#78716c',
        RESEARCHED: '#6366f1',
        DRAFTED: '#8b5cf6',
        VALIDATED: '#0d9488',
        PENDING: '#d97706',
        QUEUED: '#db2777',
        PUBLISHED: '#16a34a',
        REJECTED: '#dc2626',
        REJECTED_ERROR: '#ea580c',
        FAILED: '#b91c1c',
        // Logs
        INFO: '#0284c7',
        WARN: '#d97706',
        SUCCESS: '#16a34a',
        // Diffusions
        PUBLISHING: '#0d9488',
        // Sources
        OK: '#16a34a',
        TIMEOUT: '#d97706',
        ERROR: '#dc2626',
    };

    const color = COLORS[value] ?? '#6b7280';

    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                color: '#ffffff',
                backgroundColor: color,
                letterSpacing: '0.03em',
                whiteSpace: 'nowrap',
                lineHeight: '1.6',
            }}
        >
            {label}
        </span>
    );
}
