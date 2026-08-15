'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

const STATUS_META: Record<string, { label: string; color: string }> = {
    INGESTED: { label: 'Ingéré', color: '#94a3b8' },
    RESEARCHED: { label: 'Analysé', color: '#60a5fa' },
    DRAFTED: { label: 'Rédigé', color: '#a78bfa' },
    VALIDATED: { label: 'Validé', color: '#34d399' },
    PENDING: { label: 'En attente', color: '#fbbf24' },
    QUEUED: { label: 'En file', color: '#f472b6' },
    PUBLISHED: { label: 'Publié', color: '#22c55e' },
    REJECTED: { label: 'Rejeté', color: '#ef4444' },
    REJECTED_ERROR: { label: 'Erreur', color: '#f97316' },
    FAILED: { label: 'Échec', color: '#dc2626' },
};

const HEALTH_META: Record<string, { label: string; color: string }> = {
    ok: { label: 'Stable', color: '#22c55e' },
    late: { label: 'Retard / Inactif', color: '#f59e0b' },
    paused: { label: 'Autopilote off', color: '#94a3b8' },
};

export function RadarDashboardClient(props: {
    counts: Record<string, number>;
    total: number;
    lastLogAt: string | null;
    lastLogMessage: string | null;
    daemonHealth: 'ok' | 'late' | 'paused';
    autoPublish: boolean;
    aiModel: string;
}) {
    const { counts, total, lastLogAt, lastLogMessage, daemonHealth, autoPublish, aiModel } = props;

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
        setScanOutput(['🚀 Démarrage du cycle d’investigation…']);
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

    return (
        <div style={{ padding: '24px 32px', maxWidth: 1100, margin: '0 auto' }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>Radar — Cockpit</h1>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
                Pipeline d’investigation automatisé. Toutes les données vivent désormais dans Payload.
            </p>

            {/* Bandeau de statut */}
            <div
                style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    padding: '12px 16px',
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: '#f9fafb',
                    marginBottom: 24,
                }}
            >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: health.color, display: 'inline-block' }} />
                    {health.label}
                </span>
                <span style={{ fontSize: 13, color: '#374151' }}>
                    Dernier cycle : <strong>{lastLogLabel}</strong>
                    {lastLogMessage ? ` — ${lastLogMessage.slice(0, 80)}` : ''}
                </span>
                <span style={{ fontSize: 13, color: '#374151' }}>
                    Modèle IA : <strong>{aiModel}</strong>
                </span>
                <span style={{ fontSize: 13, color: autoPublish ? '#16a34a' : '#6b7280' }}>
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
                        background: scanning ? '#9ca3af' : '#111827',
                        border: 'none',
                        borderRadius: 6,
                        cursor: scanning ? 'not-allowed' : 'pointer',
                    }}
                >
                    {scanning ? 'Scan en cours…' : '⚡ Nouveau scan'}
                </button>
            </div>

            {/* Compteurs par statut */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: 12,
                    marginBottom: 24,
                }}
            >
                <CounterCard label="Total" value={total} color="#111827" href="/admin/collections/signals" />
                {Object.entries(STATUS_META).map(([status, meta]) => (
                    <CounterCard
                        key={status}
                        label={meta.label}
                        value={counts[status] || 0}
                        color={meta.color}
                        href={`/admin/collections/signals?where[status][equals]=${status}`}
                    />
                ))}
            </div>

            {/* Sortie du scan */}
            {scanOutput.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Sortie du scan</h2>
                    <pre
                        ref={outputRef}
                        style={{
                            background: '#111827',
                            color: '#e5e7eb',
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

            {/* Accès rapides */}
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px' }}>Accès rapides</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                <QuickLink title="Signals" desc="Sujets du pipeline" href="/admin/collections/signals" />
                <QuickLink title="Sources" desc="RSS, Telegram, Google News" href="/admin/collections/sources" />
                <QuickLink title="Publications" desc="Missions de diffusion" href="/admin/collections/publications" />
                <QuickLink title="Logs" desc="Journal du daemon" href="/admin/collections/logs" />
                <QuickLink title="Templates" desc="Formats éditoriaux IA" href="/admin/collections/taxonomy-templates" />
                <QuickLink title="Radar Settings" desc="Configuration globale" href="/admin/globals/radar-settings" />
            </div>
        </div>
    );
}

function CounterCard({ label, value, color, href }: { label: string; value: number; color: string; href: string }) {
    return (
        <a
            href={href}
            style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                padding: '14px 16px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#fff',
            }}
        >
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{label}</div>
        </a>
    );
}

function QuickLink({ title, desc, href }: { title: string; desc: string; href: string }) {
    return (
        <a
            href={href}
            style={{
                display: 'block',
                textDecoration: 'none',
                color: 'inherit',
                padding: '14px 16px',
                borderRadius: 8,
                border: '1px solid #e5e7eb',
                background: '#fff',
            }}
        >
            <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{desc}</div>
        </a>
    );
}
