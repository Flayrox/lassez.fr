'use client';

import React, { useState } from 'react';
import { useField } from '@payloadcms/ui';

type Model = { value: string; label: string };

function parseModels(raw: unknown): Model[] {
    if (Array.isArray(raw)) {
        return raw
            .map((m) => (typeof m === 'object' && m ? { value: String((m as any).value || ''), label: String((m as any).label || '') } : null))
            .filter((m): m is Model => Boolean(m && m.value));
    }
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parseModels(parsed);
        } catch {
            /* ignore */
        }
    }
    return [];
}

/**
 * Liste de modèles IA éditable — remplace la saisie JSON brute du champ
 * `availableModelsJson` (radar-settings → onglet Avancé). Affiche une liste
 * de cartes (label + value) avec boutons de suppression et un formulaire
 * d'ajout inline ; la valeur est synchronisée en JSON dans le champ parent.
 */
export default function ModelListField(props: any) {
    const { path = props?.field?.name } = props;
    const { value, setValue } = useField<string>({ path });

    const models = parseModels(value);
    const [draftLabel, setDraftLabel] = useState('');
    const [draftValue, setDraftValue] = useState('');
    const [error, setError] = useState<string | null>(null);

    const commit = (next: Model[]) => setValue(JSON.stringify(next));

    const add = (e: React.FormEvent) => {
        e.preventDefault();
        const val = draftValue.trim();
        const label = draftLabel.trim() || val;
        if (!val) {
            setError('Le champ « value » est requis.');
            return;
        }
        if (models.some((m) => m.value === val)) {
            setError(`Le modèle « ${val} » est déjà dans la liste.`);
            return;
        }
        commit([...models, { value: val, label }]);
        setDraftLabel('');
        setDraftValue('');
        setError(null);
    };

    const remove = (valueToRemove: string) => {
        commit(models.filter((m) => m.value !== valueToRemove));
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px 10px',
        borderRadius: 4,
        border: '1px solid var(--theme-elevation-250)',
        background: 'var(--theme-input-bg, var(--theme-elevation-0))',
        color: 'var(--theme-text)',
        fontSize: 14,
        boxSizing: 'border-box',
    };

    const cellStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '8px 12px',
        border: '1px solid var(--theme-elevation-200)',
        borderRadius: 4,
        background: 'var(--theme-elevation-50, #f9f9f9)',
        marginBottom: 6,
        fontSize: 13,
    };

    return (
        <div style={{ margin: '6px 0 12px' }}>
            {models.length === 0 && (
                <div style={{ ...cellStyle, color: 'var(--theme-elevation-400)' }}>
                    Aucun modèle — la liste est vide. Ajoutez-en un ci-dessous.
                </div>
            )}
            {models.map((m) => (
                <div key={m.value} style={cellStyle}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
                        <span style={{ fontWeight: 600, color: 'var(--theme-text)' }}>{m.label || m.value}</span>
                        {m.label && m.label !== m.value && (
                            <code style={{ fontSize: 11, color: 'var(--theme-elevation-400)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.value}</code>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={() => remove(m.value)}
                        title={`Supprimer ${m.label || m.value}`}
                        style={{
                            flexShrink: 0,
                            background: 'var(--color-error-100, #fee2e2)',
                            color: 'var(--color-error-500, #dc2626)',
                            border: 0,
                            borderRadius: 4,
                            width: 26,
                            height: 26,
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 14,
                            lineHeight: 1,
                        }}
                    >
                        ✕
                    </button>
                </div>
            ))}

            <form
                onSubmit={add}
                style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr auto', gap: 8, marginTop: 4 }}
            >
                <input
                    value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    placeholder="Label (ex. Gemini 2.5 Pro)"
                    style={inputStyle}
                />
                <input
                    value={draftValue}
                    onChange={(e) => setDraftValue(e.target.value)}
                    placeholder="value (ex. gemini-2.5-pro)"
                    style={inputStyle}
                />
                <button
                    type="submit"
                    style={{
                        padding: '8px 12px',
                        borderRadius: 4,
                        border: 0,
                        background: 'var(--color-success-500, #16a34a)',
                        color: '#fff',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                    }}
                >
                    ＋ Ajouter
                </button>
            </form>

            {error && (
                <div style={{ marginTop: 8, background: 'var(--color-error-100, #fee2e2)', color: 'var(--color-error-500, #dc2626)', padding: '8px 10px', borderRadius: 4, fontSize: 13 }}>
                    {error}
                </div>
            )}
        </div>
    );
}
