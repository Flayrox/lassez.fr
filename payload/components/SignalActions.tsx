'use client';

import React, { useState } from 'react';

/**
 * Actions inline d'un sujet (signal) : approuver, rejeter, mettre en file de
 * publication, générer le visuel, ouvrir la révélation publiée.
 *
 * Utilisé dans deux contextes :
 *  - la colonne « Actions » de la liste Payload des sujets (SignalActionsCell) ;
 *  - le cockpit d'investigation (DashboardClient).
 *
 * Chaque action PATCH le signal via l'API REST Payload (session admin) puis
 * recharge la vue — aucune navigation vers la page d'édition.
 */
export function SignalActions(props: {
    signal: {
        id: number | string;
        status: string;
        revelation?: number | string | null;
        hasDraft?: boolean;
    };
    compact?: boolean;
}) {
    const { signal, compact } = props;
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const patchStatus = async (status: string) => {
        setBusy(status);
        setError(null);
        try {
            const res = await fetch(`/api/payload/signals/${signal.id}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const msg = data?.errors?.map((err: any) => err.message).join(' · ') || `HTTP ${res.status}`;
                throw new Error(msg);
            }
            window.location.reload();
        } catch (e: any) {
            setError(e.message || 'Erreur inconnue');
            setBusy(null);
        }
    };

    const generateVisual = async () => {
        setBusy('visual');
        setError(null);
        try {
            const res = await fetch('/api/payload/radar/generate-image', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: signal.id }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || `HTTP ${res.status}`);
            }
            window.location.reload();
        } catch (e: any) {
            setError(e.message || 'Erreur inconnue');
            setBusy(null);
        }
    };

    // Publication directe : crée la révélation publiée immédiatement (même
    // logique que le publisher Go), sans attendre le prochain cycle du daemon.
    const publishDirect = async () => {
        setBusy('publish');
        setError(null);
        try {
            const res = await fetch('/api/payload/radar/publish-signal', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: signal.id }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
                throw new Error(data?.error || `HTTP ${res.status}`);
            }
            window.location.reload();
        } catch (e: any) {
            setError(e.message || 'Erreur inconnue');
            setBusy(null);
        }
    };

    const s = String(signal.status || '');
    const canApprove = ['INGESTED', 'RESEARCHED', 'DRAFTED'].includes(s);
    const canPublish = ['VALIDATED', 'DRAFTED'].includes(s);
    const canReject = ['INGESTED', 'RESEARCHED', 'DRAFTED', 'VALIDATED', 'PENDING', 'QUEUED'].includes(s);
    const canRelaunch = ['REJECTED', 'REJECTED_ERROR', 'FAILED'].includes(s);

    const btnBase: React.CSSProperties = {
        padding: compact ? '3px 8px' : '5px 10px',
        borderRadius: 4,
        border: '1px solid var(--theme-elevation-250)',
        background: 'var(--theme-elevation-0)',
        color: 'var(--theme-text)',
        fontSize: 12,
        cursor: 'pointer',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        opacity: busy ? 0.6 : 1,
    };
    const btnGreen: React.CSSProperties = { ...btnBase, borderColor: '#16a34a', color: '#15803d' };
    const btnOrange: React.CSSProperties = { ...btnBase, borderColor: '#d97706', color: '#b45309' };
    const btnRed: React.CSSProperties = { ...btnBase, borderColor: '#dc2626', color: '#b91c1c' };

    return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {canApprove && (
                <button type="button" style={btnGreen} disabled={!!busy} onClick={() => patchStatus('VALIDATED')}>
                    {busy === 'VALIDATED' ? '…' : '✓ Approuver'}
                </button>
            )}
            {canPublish && (
                <button type="button" style={btnGreen} disabled={!!busy} onClick={publishDirect}>
                    {busy === 'publish' ? '…' : '🚀 Publier la révélation'}
                </button>
            )}
            {canRelaunch && (
                <button type="button" style={btnOrange} disabled={!!busy} onClick={() => patchStatus('DRAFTED')}>
                    {busy === 'DRAFTED' ? '…' : '↻ Relancer'}
                </button>
            )}
            {signal.hasDraft && (
                <button type="button" style={btnOrange} disabled={!!busy} onClick={generateVisual}>
                    {busy === 'visual' ? '…' : '🖼 Visuel'}
                </button>
            )}
            {canReject && (
                <button type="button" style={btnRed} disabled={!!busy} onClick={() => patchStatus('REJECTED')}>
                    {busy === 'REJECTED' ? '…' : '✗ Rejeter'}
                </button>
            )}
            {signal.revelation ? (
                <a
                    href={`/admin/collections/revelations/${signal.revelation}`}
                    style={{ ...btnBase, textDecoration: 'none', borderColor: '#16a34a', color: '#15803d' }}
                >
                    🔗 Révélation →
                </a>
            ) : null}
            {error && (
                <span style={{ color: '#dc2626', fontSize: 11, maxWidth: 220 }} title={error}>
                    ⚠ {error.slice(0, 60)}
                </span>
            )}
        </div>
    );
}
