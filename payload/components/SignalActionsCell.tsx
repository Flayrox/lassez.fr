'use client';

import React from 'react';
import { SignalActions } from './SignalActions';

/**
 * Colonne « Actions » de la liste des sujets (signals) : wrapper natif Payload
 * qui transmet `rowData` (le document de la ligne) au composant d'actions
 * inline. Branché via un champ `ui` nommé `actions` + defaultColumns.
 */
export default function SignalActionsCell({ rowData }: { rowData?: Record<string, any> }) {
    if (!rowData || !rowData.id) return null;

    return (
        <SignalActions
            compact
            signal={{
                id: rowData.id,
                status: rowData.status || '—',
                revelation: rowData.revelation ?? null,
                hasDraft: Boolean(rowData.final_draft),
            }}
        />
    );
}
