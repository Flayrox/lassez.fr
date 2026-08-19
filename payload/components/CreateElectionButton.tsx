'use client';

import React, { useState } from 'react';

/**
 * « Nouvelle élection (rapide) » — interface d'import pour les prochains
 * scrutins, affichée au-dessus de la liste des Élections (slot
 * admin.components.views.list.beforeListTable).
 *
 * Renvoie à l'essentiel : nom, slug, catégorie et les slugs des datasets
 * data.gouv (résultats + candidatures, 1er/2nd tour). Une fois créée, on peut
 * compléter la config daemon/affichage dans la page d'édition.
 */
export default function CreateElectionButton() {
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [label, setLabel] = useState('');
    const [slug, setSlug] = useState('');
    const [category, setCategory] = useState('municipales');
    const [dsFirst, setDsFirst] = useState('');
    const [dsSecond, setDsSecond] = useState('');
    const [cdFirst, setCdFirst] = useState('');
    const [cdSecond, setCdSecond] = useState('');

    const reset = () => {
        setLabel('');
        setSlug('');
        setCategory('municipales');
        setDsFirst('');
        setDsSecond('');
        setCdFirst('');
        setCdSecond('');
        setError(null);
    };

    const close = () => {
        setOpen(false);
        setError(null);
    };

    const slugify = (raw: string) =>
        raw
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const datasets = [
                { role: 'results_first_tour', dataset_slug: dsFirst.trim() },
                { role: 'results_second_tour', dataset_slug: dsSecond.trim() },
                { role: 'candidates_first_tour', dataset_slug: cdFirst.trim() },
                { role: 'candidates_second_tour', dataset_slug: cdSecond.trim() },
            ].filter((d) => d.dataset_slug);

            const res = await fetch('/api/payload/elections', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: label.trim(),
                    slug: slug.trim() || slugify(label),
                    category,
                    status: 'draft',
                    datasets,
                }),
            });
            if (!res.ok) {
                const data = await res.json().catch(() => null);
                const msg = data?.errors?.map((err: any) => err.message).join(' · ') || `HTTP ${res.status}`;
                throw new Error(msg);
            }
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
                ＋ Nouvelle élection (import rapide)
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
                            maxWidth: 560,
                            boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
                            boxSizing: 'border-box',
                            maxHeight: '80vh',
                            overflowY: 'auto',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: 18 }}>Importer une élection</h3>
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
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Nom du scrutin *</label>
                                    <input
                                        required
                                        value={label}
                                        onChange={(e) => {
                                            setLabel(e.target.value);
                                            if (!slug) setSlug(slugify(e.target.value));
                                        }}
                                        placeholder="Législatives 2027"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Slug</label>
                                    <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="legislatives-2027" style={inputStyle} />
                                </div>
                            </div>

                            <div>
                                <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>Catégorie *</label>
                                <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
                                    <option value="municipales">Municipales</option>
                                    <option value="presidentielles">Présidentielles</option>
                                    <option value="legislatives">Législatives</option>
                                    <option value="europeennes">Européennes</option>
                                    <option value="regionales">Régionales</option>
                                    <option value="departementales">Départementales</option>
                                    <option value="referendum">Référendum</option>
                                    <option value="autre">Autre</option>
                                </select>
                            </div>

                            <div style={{ borderTop: '1px solid var(--theme-elevation-150)', paddingTop: 10, marginTop: 4 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Jeux de données data.gouv (optionnel, modifiable après)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, opacity: 0.8 }}>Résultats — 1er tour</label>
                                        <input value={dsFirst} onChange={(e) => setDsFirst(e.target.value)} placeholder="elections-legislatives-2027-resultats-tour-1" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, opacity: 0.8 }}>Résultats — 2nd tour</label>
                                        <input value={dsSecond} onChange={(e) => setDsSecond(e.target.value)} placeholder="elections-legislatives-2027-resultats-tour-2" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, opacity: 0.8 }}>Candidatures — 1er tour</label>
                                        <input value={cdFirst} onChange={(e) => setCdFirst(e.target.value)} placeholder="elections-legislatives-2027-candidats-tour-1" style={inputStyle} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: 4, fontSize: 12, opacity: 0.8 }}>Candidatures — 2nd tour</label>
                                        <input value={cdSecond} onChange={(e) => setCdSecond(e.target.value)} placeholder="elections-legislatives-2027-candidats-tour-2" style={inputStyle} />
                                    </div>
                                </div>
                            </div>

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
                                    {saving ? 'Création…' : 'Importer'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
