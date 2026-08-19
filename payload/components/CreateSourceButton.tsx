'use client';

import React, { useState } from 'react';

/**
 * « Créer une source » rapide, affiché au-dessus de la liste des Sources
 * (slot admin.components.views.list.beforeListTable).
 *
 * Ouvre une modale avec les seuls champs utiles à la création (URL, type,
 * nom, orientation, score, actif) puis enregistre via l'API REST Payload —
 * pas de navigation vers la page d'édition complète.
 */
export default function CreateSourceButton() {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [url, setUrl] = useState('');
    const [type, setType] = useState('RSS');
    const [sourceName, setSourceName] = useState('');
    const [sourceBias, setSourceBias] = useState('Indépendant');
    const [trustScore, setTrustScore] = useState(5);
    const [active, setActive] = useState(true);

    const reset = () => {
        setUrl('');
        setType('RSS');
        setSourceName('');
        setSourceBias('Indépendant');
        setTrustScore(5);
        setActive(true);
        setError(null);
    };

    const close = () => {
        setOpen(false);
        setError(null);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch('/api/payload/sources', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    type,
                    source_name: sourceName.trim(),
                    source_bias: sourceBias.trim(),
                    trust_score: trustScore,
                    active,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const msg = data?.errors?.map((err: any) => err.message).join(' · ') || `HTTP ${res.status}`;
                throw new Error(msg);
            }
            // La liste est enregistrée : on recharge pour afficher la nouvelle ligne.
            window.location.reload();
        } catch (err: any) {
            setError(err.message || 'Erreur inconnue');
            setSaving(false);
        }
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

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    reset();
                    setOpen(true);
                }}
                style={{
                    marginBottom: 12,
                    padding: '9px 14px',
                    borderRadius: 4,
                    border: 0,
                    background: 'var(--color-success-500, #16a34a)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                }}
            >
                ＋ Nouvelle source (rapide)
            </button>

            {open && (
                <div
                    onClick={close}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 1000,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        padding: '8vh 16px 16px',
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--theme-elevation-0, #fff)',
                            color: 'var(--theme-text, #111)',
                            borderRadius: 8,
                            padding: 20,
                            width: '100%',
                            maxWidth: 520,
                            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                            boxSizing: 'border-box',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 18 }}>Créer une source</h3>
                            <button
                                type="button"
                                onClick={close}
                                aria-label="Fermer"
                                style={{ background: 'none', border: 0, fontSize: 20, cursor: 'pointer', color: 'var(--theme-elevation-500)' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>URL du flux *</label>
                                <input required type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://exemple.fr/rss" style={inputStyle} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Type *</label>
                                    <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
                                        <option value="RSS">RSS</option>
                                        <option value="TELEGRAM">Telegram</option>
                                        <option value="GOOGLE_NEWS">Google News</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Score de confiance</label>
                                    <input type="number" min={1} max={10} value={trustScore} onChange={(e) => setTrustScore(Number(e.target.value))} style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Nom de la source *</label>
                                <input required value={sourceName} onChange={(e) => setSourceName(e.target.value)} placeholder="Le Monde" style={inputStyle} />
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Orientation éditoriale</label>
                                <input value={sourceBias} onChange={(e) => setSourceBias(e.target.value)} style={inputStyle} />
                            </div>

                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                                <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
                                Source active
                            </label>

                            {error && (
                                <div style={{ background: 'var(--color-error-100, #fee2e2)', color: 'var(--color-error-500, #dc2626)', padding: '8px 10px', borderRadius: 4, fontSize: 13 }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                                <button
                                    type="button"
                                    onClick={close}
                                    style={{ padding: '8px 14px', borderRadius: 4, border: '1px solid var(--theme-elevation-250)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: 4,
                                        border: 0,
                                        background: 'var(--color-success-500, #16a34a)',
                                        color: '#fff',
                                        fontWeight: 600,
                                        cursor: saving ? 'default' : 'pointer',
                                        opacity: saving ? 0.6 : 1,
                                        fontSize: 13,
                                    }}
                                >
                                    {saving ? 'Création…' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
