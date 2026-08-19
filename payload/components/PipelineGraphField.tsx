'use client';

import React, { useState } from 'react';
import { useField } from '@payloadcms/ui';

// ---------------------------------------------------------------------------
// Définition des nœuds du pipeline. Chaque nœud correspond à un type reconnu
// par le daemon Go (daemon/internal/pipeline/pipeline.go + internal/nodes).
// Les settings listés sont les clés réellement lues par le Go.
// ---------------------------------------------------------------------------

type SettingKind = 'number' | 'text' | 'bool';

interface SettingSpec {
    key: string;
    label: string;
    kind: SettingKind;
    placeholder?: string;
    hint?: string;
    default?: any;
}

interface NodeSpec {
    type: string;
    label: string;
    emoji: string;
    desc: string;
    color: string;
    settings: SettingSpec[];
}

const NODE_SPECS: NodeSpec[] = [
    {
        type: 'ingestion',
        label: 'Ingestion',
        emoji: '📡',
        desc: 'Aspire les sources configurées (collection Sources + flux RSS + Google News)',
        color: '#0d9488',
        settings: [
            { key: 'rss_lookback_hours', label: 'Fenêtre de retour (heures)', kind: 'number', default: 12, hint: 'Articles plus vieux que cette fenêtre sont ignorés' },
        ],
    },
    {
        type: 'dedup',
        label: 'Déduplication',
        emoji: '🗑️',
        desc: 'Élimine les doublons entre les articles aspirés',
        color: '#6b7280',
        settings: [
            { key: 'similarityThreshold', label: 'Seuil de similarité', kind: 'number', default: 0.45, hint: '0 à 1 — plus bas = plus de doublons détectés' },
            { key: 'dedupLookbackHours', label: 'Fenêtre de dédoublonnage (heures)', kind: 'number', default: 48 },
        ],
    },
    {
        type: 'research',
        label: 'Recherche IA',
        emoji: '🤖',
        desc: 'Scoring & filtrage IA des sujets détectés (modèle Flash)',
        color: '#4a6cf7',
        settings: [
            { key: 'aiModelFlash', label: 'Modèle IA (Analyse)', kind: 'text', placeholder: 'gemini-3.5-flash-lite' },
            { key: 'maxConcurrentTasks', label: 'Tâches simultanées', kind: 'number', default: 5 },
            { key: 'maxItemsPerCycle', label: 'Sujets max par cycle', kind: 'number', default: 10, hint: 'Protège le quota Gemini' },
            { key: 'customPromptModifier', label: 'Consignes éditoriales spécifiques', kind: 'text', placeholder: 'Prioriser les sujets de justice sociale…' },
        ],
    },
    {
        type: 'editor',
        label: 'Rédaction IA',
        emoji: '✍️',
        desc: 'Rédige les brouillons d’investigation (modèle Pro)',
        color: '#8b5cf6',
        settings: [
            { key: 'aiModelPro', label: 'Modèle IA (Rédaction)', kind: 'text', placeholder: 'gemini-3.5-flash-lite' },
            { key: 'maxConcurrentTasks', label: 'Tâches simultanées', kind: 'number', default: 3 },
            { key: 'maxItemsPerCycle', label: 'Sujets max par cycle', kind: 'number', default: 10 },
        ],
    },
    {
        type: 'validator',
        label: 'Validation IA',
        emoji: '⚖️',
        desc: 'Vérifie la conformité éditoriale des brouillons',
        color: '#ea580c',
        settings: [
            { key: 'aiModelValidator', label: 'Modèle IA (Validation)', kind: 'text', placeholder: 'gemini-3.5-flash-lite' },
            { key: 'maxConcurrentTasks', label: 'Tâches simultanées', kind: 'number', default: 5 },
            { key: 'maxItemsPerCycle', label: 'Sujets max par cycle', kind: 'number', default: 10 },
        ],
    },
    {
        type: 'media',
        label: 'Visuels',
        emoji: '📸',
        desc: 'Assignation et génération des visuels des sujets',
        color: '#db2777',
        settings: [
            { key: 'allowSourceImages', label: 'Autoriser les images sources', kind: 'bool', default: true },
        ],
    },
    {
        type: 'publisher',
        label: 'Diffusion',
        emoji: '🚀',
        desc: 'Tour de contrôle : planifie et expédie vers les plateformes',
        color: '#16a34a',
        settings: [
            { key: 'minPublishDelay', label: 'Délai min (min)', kind: 'number', default: 60 },
            { key: 'maxPublishDelay', label: 'Délai max (min)', kind: 'number', default: 120 },
            { key: 'enableAutoPublish', label: 'Pilote automatique', kind: 'bool', default: true, hint: 'Désactivé = planifie sans expédier' },
        ],
    },
];

// ---------------------------------------------------------------------------
// Parsing / sérialisation du graphe
// ---------------------------------------------------------------------------

interface GraphNode {
    id: string;
    type: string;
    label?: string;
    enabled?: boolean;
    settings?: { key: string; label?: string; value: any }[];
}

function parseGraph(raw: unknown): GraphNode[] {
    let obj: any = raw;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            obj = JSON.parse(raw);
        } catch {
            return [];
        }
    }
    if (obj && Array.isArray(obj.nodes)) return obj.nodes;
    if (Array.isArray(obj)) return obj;
    return [];
}

function serializeGraph(nodes: GraphNode[]): string {
    return JSON.stringify({ nodes }, null, 2);
}

/** Renvoie la valeur d'un setting du nœud, ou la valeur par défaut du spec. */
function settingValue(node: GraphNode, key: string, spec?: SettingSpec): any {
    const found = node.settings?.find((s) => s.key === key);
    if (found && found.value !== undefined && found.value !== null && found.value !== '') {
        return found.value;
    }
    return spec?.default ?? '';
}

// ---------------------------------------------------------------------------
// Composant
// ---------------------------------------------------------------------------

export default function PipelineGraphField(props: any) {
    const { path = props?.field?.name } = props;
    const { value, setValue } = useField<string>({ path });

    const nodes = parseGraph(value);
    const [error, setError] = useState<string | null>(null);

    const commit = (next: GraphNode[]) => {
        try {
            setValue(serializeGraph(next));
            setError(null);
        } catch (e: any) {
            setError(String(e?.message || e));
        }
    };

    const nodeByType = (type: string) => nodes.find((n) => n.type === type);

    const setEnabled = (type: string, enabled: boolean) => {
        const existing = nodeByType(type);
        const spec = NODE_SPECS.find((n) => n.type === type);
        if (existing) {
            commit(nodes.map((n) => (n.type === type ? { ...n, enabled } : n)));
        } else if (spec) {
            // Nouveau nœud : on ajoute ses settings avec les valeurs par défaut.
            const settings = spec.settings.map((s) => ({
                key: s.key,
                label: s.label,
                value: s.default ?? (s.kind === 'bool' ? false : ''),
            }));
            commit([...nodes, { id: spec.type, type: spec.type, label: spec.label, enabled, settings }]);
        }
    };

    const setSetting = (type: string, key: string, nextValue: any) => {
        commit(
            nodes.map((n) => {
                if (n.type !== type) return n;
                const settings = n.settings || [];
                const idx = settings.findIndex((s) => s.key === key);
                const updated = { key, value: nextValue };
                if (idx >= 0) settings[idx] = { ...settings[idx], ...updated };
                else settings.push(updated);
                return { ...n, settings: [...settings] };
            }),
        );
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '6px 8px',
        borderRadius: 4,
        border: '1px solid var(--theme-elevation-250)',
        background: 'var(--theme-input-bg, var(--theme-elevation-0))',
        color: 'var(--theme-text)',
        fontSize: 13,
        boxSizing: 'border-box',
    };

    return (
        <div style={{ margin: '6px 0 12px' }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--theme-elevation-500)' }}>
                Activez / désactivez les étapes du pipeline et ajustez leurs réglages. Les modifications sont sauvegardées
                automatiquement dans le graphe.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10 }}>
                {NODE_SPECS.map((spec) => {
                    const node = nodeByType(spec.type);
                    const enabled = node ? node.enabled !== false : false;
                    const isNew = !node;

                    return (
                        <div
                            key={spec.type}
                            style={{
                                border: `1px solid ${enabled ? spec.color : 'var(--theme-elevation-250)'}`,
                                borderRadius: 8,
                                background: enabled ? 'var(--theme-elevation-50)' : 'var(--theme-elevation-0)',
                                opacity: enabled ? 1 : 0.75,
                                padding: '10px 12px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 8,
                            }}
                        >
                            {/* En-tête : toggle + nom */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 18, lineHeight: 1 }}>{spec.emoji}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--theme-text)' }}>{spec.label}</div>
                                    {isNew && (
                                        <div style={{ fontSize: 11, color: 'var(--theme-elevation-400)' }}>désactivé — non présent dans le graphe</div>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEnabled(spec.type, !enabled)}
                                    title={enabled ? `Désactiver ${spec.label}` : `Activer ${spec.label}`}
                                    style={{
                                        position: 'relative',
                                        width: 38,
                                        height: 20,
                                        borderRadius: 999,
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: enabled ? spec.color : 'var(--theme-elevation-300)',
                                        transition: 'background 0.15s',
                                        flexShrink: 0,
                                    }}
                                >
                                    <span
                                        style={{
                                            position: 'absolute',
                                            top: 2,
                                            left: enabled ? 20 : 2,
                                            width: 16,
                                            height: 16,
                                            borderRadius: '50%',
                                            background: '#fff',
                                            transition: 'left 0.15s',
                                        }}
                                    />
                                </button>
                            </div>

                            {enabled && (
                                <>
                                    <div style={{ fontSize: 11, color: 'var(--theme-elevation-500)', lineHeight: 1.35 }}>{spec.desc}</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {spec.settings.map((s) => {
                                            const current = settingValue(node, s.key, s);
                                            return (
                                                <label key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12 }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--theme-elevation-600)' }}>{s.label}</span>
                                                    {s.kind === 'bool' ? (
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={Boolean(current)}
                                                                onChange={(e) => setSetting(spec.type, s.key, e.target.checked)}
                                                            />
                                                            <span style={{ color: 'var(--theme-elevation-500)' }}>{current ? 'oui' : 'non'}</span>
                                                        </span>
                                                    ) : (
                                                        <input
                                                            type={s.kind === 'number' ? 'number' : 'text'}
                                                            value={String(current)}
                                                            placeholder={s.placeholder}
                                                            onChange={(e) =>
                                                                setSetting(spec.type, s.key, s.kind === 'number' ? Number(e.target.value) : e.target.value)
                                                            }
                                                            style={inputStyle}
                                                        />
                                                    )}
                                                    {s.hint && <span style={{ fontSize: 10, color: 'var(--theme-elevation-400)' }}>{s.hint}</span>}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {error && (
                <div style={{ marginTop: 8, background: 'var(--color-error-100, #fee2e2)', color: 'var(--color-error-500, #dc2626)', padding: '8px 10px', borderRadius: 4, fontSize: 13 }}>
                    {error}
                </div>
            )}
        </div>
    );
}
