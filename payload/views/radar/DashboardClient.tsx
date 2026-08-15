'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// Étapes du pipeline, dans l'ordre d'exécution (chaque carte pointe vers la
// collection signals filtrée sur ce statut).
const PIPELINE: { status: string; label: string; hint: string }[] = [
    { status: 'INGESTED', label: 'Ingéré', hint: 'Node 1-2' },
    { status: 'RESEARCHED', label: 'Analysé', hint: 'Node 3' },
    { status: 'DRAFTED', label: 'Rédigé', hint: 'Node 4' },
    { status: 'VALIDATED', label: 'Validé', hint: 'Node 5' },
    { status: 'PENDING', label: 'En attente', hint: 'Node 6' },
    { status: 'PUBLISHED', label: 'Publié', hint: 'Diffusé' },
];

const TERMINAL: { status: string; label: string }[] = [
    { status: 'REJECTED', label: 'Rejetés' },
    { status: 'REJECTED_ERROR', label: 'Erreurs' },
    { status: 'FAILED', label: 'Échecs' },
];

const HEALTH_META: Record<string, { label: string; color: string }> = {
    ok: { label: 'Daemon stable', color: '#15803d' },
    late: { label: 'Daemon en retard', color: '#b45309' },
    paused: { label: 'Autopilote off', color: '#6b7280' },
};

export function RadarDashboardClient(props: {
    counts: Record<string, number>;
    total: number;
    lastLogAt: string | null;
    lastLogMessage: string | null;
    daemonHealth: 'ok' | 'late' | 'paused';
    autoPublish: boolean;
    aiModel: string;
    recentSignals: { id: string; title: string; status: string; updatedAt: string | null }[];
    duePubs: number;
    errors: number;
}) {
    const { counts, total, lastLogAt, lastLogMessage, daemonHealth, autoPublish, aiModel, recentSignals, duePubs, errors } = props;

    const [scanOutput, setScanOutput] = useState<string[]>([]);
    const [scanning, setScanning] = useState(false);
    const outputRef = useRef<HTMLPreElement>(null);

    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [scanOutput]);

    const launchScan = useCallback(async () => {
        setScanning(true);
        setScanOutput(['Démarrage du cycle d’investigation…']);
        try {
            const res = await fetch('/api/payload/radar/trigger', { method: 'POST', credentials: 'include' });
            if (!res.ok || !res.body) {
                throw new Error(`HTTP ${res.status}`);
            }
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                setScanOutput((prev) => [...prev, ...chunk.split('\n').filter((l) => l.trim())]);
            }
        } catch (e: any) {
            setScanOutput((prev) => [...prev, `❌ Erreur : ${e.message}`]);
        } finally {
            setScanning(false);
        }
    }, []);

    const health = HEALTH_META[daemonHealth] || HEALTH_META.ok;
    const lastLogLabel = lastLogAt ? new Date(lastLogAt).toLocaleString('fr-FR') : 'jamais';

    const stat = (s: string) => counts[s] || 0;

    return (
        <div style={{ padding: '28px 32px 64px', maxWidth: 1160, margin: '0 auto' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Radar — Cockpit</h1>
            <p style={{ fontSize: 13, color: 'var(--theme-elevation-500)', margin: '0 0 24px' }}>
                Pipeline d’investigation automatisé. Toutes les données vivent dans les collections Payload.
            </p>

            {/* Bandeau d'état */}
            <div
                style={{
                    display: 'flex',
                    gap: 20,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid var(--theme-elevation-200)',
                    background: 'var(--theme-elevation-50)',
                    marginBottom: 28,
                }}
            >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: health.color, display: 'inline-block' }} />
                    {health.label}
                </span>
                <span style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
                    Dernier cycle : <strong>{lastLogLabel}</strong>
                    {lastLogMessage ? ` — ${lastLogMessage.slice(0, 80)}` : ''}
                </span>
                <span style={{ fontSize: 13, color: 'var(--theme-elevation-600)' }}>
                    Modèle IA : <strong>{aiModel}</strong>
                </span>
                <span style={{ fontSize: 13, color: autoPublish ? '#15803d' : 'var(--theme-elevation-500)' }}>
                    {autoPublish ? '● Autopilote actif' : '○ Autopilote désactivé'}
                </span>
                <button
                    onClick={launchScan}
                    disabled={scanning}
                    style={{
                        marginLeft: 'auto',
                        padding: '8px 14px',
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#fff',
                        background: scanning ? 'var(--theme-elevation-300)' : 'var(--theme-elevation-900)',
                        border: 'none',
                        borderRadius: 6,
                        cursor: scanning ? 'not-allowed' : 'pointer',
                    }}
                >
                    {scanning ? 'Scan en cours…' : '⚡ Nouveau scan'}
                </button>
            </div>

            {/* Pipeline visuel */}
            <SectionTitle>Pipeline</SectionTitle>
            <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginBottom: 28, overflowX: 'auto', paddingBottom: 4 }}>
                <PipelineStep label="Total" value={total} hint="signals" href="/admin/collections/signals" total />
                {PIPELINE.map((step, i) => (
                    <React.Fragment key={step.status}>
                        {i > 0 && <Arrow />}
                        <PipelineStep
                            label={step.label}
                            value={stat(step.status)}
                            hint={step.hint}
                            href={`/admin/collections/signals?where[status][equals]=${step.status}`}
                        />
                    </React.Fragment>
                ))}
            </div>

            {/* Terminaux (rejets / erreurs) */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                {TERMINAL.map((t) => (
                    <a
                        key={t.status}
                        href={`/admin/collections/signals?where[status][equals]=${t.status}`}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid var(--theme-elevation-200)',
                            background: 'var(--theme-elevation-0)',
                            textDecoration: 'none',
                            color: 'inherit',
                            fontSize: 13,
                        }}
                    >
                        <strong style={{ fontSize: 15 }}>{stat(t.status)}</strong>
                        <span style={{ color: 'var(--theme-elevation-500)' }}>{t.label}</span>
                    </a>
                ))}
                {duePubs > 0 && (
                    <a
                        href="/admin/collections/publications?where[status][equals]=PENDING"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid #b45309',
                            color: '#b45309',
                            background: 'var(--theme-elevation-0)',
                            textDecoration: 'none',
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        <strong style={{ fontSize: 15 }}>{duePubs}</strong>
                        <span>publication(s) due(s)</span>
                    </a>
                )}
                {errors > 0 && (
                    <a
                        href="/admin/collections/signals?where[status][in]=REJECTED_ERROR,FAILED"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'baseline',
                            gap: 8,
                            padding: '8px 12px',
                            borderRadius: 6,
                            border: '1px solid #dc2626',
                            color: '#dc2626',
                            background: 'var(--theme-elevation-0)',
                            textDecoration: 'none',
                            fontSize: 13,
                            fontWeight: 600,
                        }}
                    >
                        <strong style={{ fontSize: 15 }}>{errors}</strong>
                        <span>erreur(s) / échec(s)</span>
                    </a>
                )}
            </div>

            {/* Derniers signals */}
            <SectionTitle>Derniers signals</SectionTitle>
            <div
                style={{
                    borderRadius: 8,
                    border: '1px solid var(--theme-elevation-200)',
                    background: 'var(--theme-elevation-0)',
                    overflow: 'hidden',
                    marginBottom: 24,
                }}
            >
                {recentSignals.length === 0 ? (
                    <p style={{ padding: '14px 16px', margin: 0, fontSize: 13, color: 'var(--theme-elevation-500)' }}>
                        Aucun signal pour l’instant — lance un scan pour démarrer.
                    </p>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: 'var(--theme-elevation-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                <th style={{ padding: '10px 16px', borderBottom: '1px solid var(--theme-elevation-200)' }}>Signal</th>
                                <th style={{ padding: '10px 16px', borderBottom: '1px solid var(--theme-elevation-200)' }}>Statut</th>
                                <th style={{ padding: '10px 16px', borderBottom: '1px solid var(--theme-elevation-200)' }}>Mise à jour</th>
                                <th style={{ padding: '10px 16px', borderBottom: '1px solid var(--theme-elevation-200)' }} />
                            </tr>
                        </thead>
                        <tbody>
                            {recentSignals.map((s) => (
                                <tr key={s.id} style={{ borderBottom: '1px solid var(--theme-elevation-100)' }}>
                                    <td style={{ padding: '10px 16px', fontWeight: 500 }}>{s.title}</td>
                                    <td style={{ padding: '10px 16px' }}>
                                        <StatusChip status={s.status} />
                                    </td>
                                    <td style={{ padding: '10px 16px', color: 'var(--theme-elevation-500)' }}>
                                        {s.updatedAt ? new Date(s.updatedAt).toLocaleString('fr-FR') : '—'}
                                    </td>
                                    <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                                        <a href={`/admin/collections/signals/${s.id}`} style={{ color: 'var(--admin-link, inherit)', textDecoration: 'none' }}>
                                            Ouvrir →
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Sortie du scan */}
            {scanOutput.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <SectionTitle>Sortie du scan</SectionTitle>
                    <pre
                        ref={outputRef}
                        style={{
                            background: 'var(--theme-elevation-900)',
                            color: 'var(--theme-elevation-100)',
                            padding: 16,
                            borderRadius: 8,
                            fontSize: 12,
                            lineHeight: 1.5,
                            maxHeight: 320,
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                        }}
                    >
                        {scanOutput.join('\n')}
                    </pre>
                </div>
            )}
        </div>
    );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
        <h2
            style={{
                fontSize: 13,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'var(--theme-elevation-600)',
                margin: '0 0 10px',
            }}
        >
            {children}
        </h2>
    );
}

function PipelineStep({ label, value, hint, href, total }: { label: string; value: number; hint: string; href: string; total?: boolean }) {
    return (
        <a
            href={href}
            style={{
                flex: '1 1 0',
                minWidth: 110,
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                padding: '12px 14px',
                borderRadius: 8,
                border: total ? '2px solid var(--theme-elevation-900)' : '1px solid var(--theme-elevation-250)',
                background: total ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-0)',
                boxSizing: 'border-box',
            }}
        >
            <div
                style={{
                    fontSize: 24,
                    fontWeight: 800,
                    lineHeight: 1,
                    color: total ? 'var(--theme-elevation-0)' : 'inherit',
                }}
            >
                {value}
            </div>
            <div
                style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: total ? 'var(--theme-elevation-300)' : 'var(--theme-elevation-600)',
                    marginTop: 6,
                }}
            >
                {label}
            </div>
            <div style={{ fontSize: 11, color: total ? 'var(--theme-elevation-400)' : 'var(--theme-elevation-400)', marginTop: 2 }}>
                {hint}
            </div>
        </a>
    );
}

function Arrow() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px', color: 'var(--theme-elevation-400)', fontSize: 16, userSelect: 'none' }}>
            →
        </div>
    );
}

const STATUS_COLORS: Record<string, string> = {
    INGESTED: '#6b7280',
    RESEARCHED: '#4a6cf7',
    DRAFTED: '#8b5cf6',
    VALIDATED: '#0d9488',
    PENDING: '#b45309',
    QUEUED: '#db2777',
    PUBLISHED: '#16a34a',
    REJECTED: '#dc2626',
    REJECTED_ERROR: '#ea580c',
    FAILED: '#7f1d1d',
};

function StatusChip({ status }: { status: string }) {
    const color = STATUS_COLORS[status] || '#6b7280';
    return (
        <span
            style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 600,
                color,
                border: `1px solid ${color}`,
                background: 'var(--theme-elevation-0)',
            }}
        >
            {status}
        </span>
    );
}
