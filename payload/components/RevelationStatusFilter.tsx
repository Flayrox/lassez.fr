'use client';

import React, { useEffect, useState } from 'react';

/**
 * Filtres rapides au-dessus de la liste des Révélations : Toutes / Brouillons /
 * Publiées. Chaque bouton navigue vers la liste Payload avec le filtre
 * `_status` correspondant — trier les révélations par statut en un clic,
 * sans ouvrir la page d'édition.
 *
 * L'état actif n'est lu (window.location) qu'après le montage, pour que le
 * premier rendu serveur et client soient identiques (pas d'erreur
 * d'hydratation React).
 */
export default function RevelationStatusFilter() {
    const [active, setActive] = useState('');

    useEffect(() => {
        const search = window.location.search || '';
        if (search.includes('_status') && search.includes('draft')) setActive('draft');
        else if (search.includes('_status') && search.includes('published')) setActive('published');
        else setActive('all');
    }, []);

    const base = '/admin/collections/revelations';
    const filters: { key: string; label: string; query: string }[] = [
        { key: 'all', label: 'Toutes', query: '' },
        { key: 'draft', label: '📝 Brouillons', query: '?where[_status][equals]=draft' },
        { key: 'published', label: '🌐 Publiées', query: '?where[_status][equals]=published' },
    ];

    const btnStyle = (isActiveBtn: boolean): React.CSSProperties => ({
        marginBottom: 12,
        marginRight: 8,
        padding: '7px 12px',
        borderRadius: 4,
        border: isActiveBtn ? '1px solid var(--theme-elevation-900)' : '1px solid var(--theme-elevation-250)',
        background: isActiveBtn ? 'var(--theme-elevation-900)' : 'var(--theme-elevation-0)',
        color: isActiveBtn ? 'var(--theme-elevation-0)' : 'var(--theme-text)',
        fontWeight: 600,
        fontSize: 13,
        cursor: 'pointer',
        textDecoration: 'none',
        display: 'inline-block',
    });

    return (
        <div>
            {filters.map((f) => (
                <a key={f.key} href={base + f.query} style={btnStyle(active === f.key)}>
                    {f.label}
                </a>
            ))}
        </div>
    );
}
