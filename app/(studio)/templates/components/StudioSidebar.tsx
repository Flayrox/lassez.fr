'use client';

import React, { useState } from 'react';
import { useStudio, SlideType } from './StudioContext';
import { getTemplate } from '../registry';

// Payload-dark design tokens
const T = {
    bg:         '#141414',
    bgHover:    '#202020',
    bgActive:   '#252525',
    border:     '#2a2a2a',
    borderMid:  '#3a3a3a',
    textPrimary:'#ffffff',
    textMid:    '#aaaaaa',
    textMuted:  '#666666',
    accentBar:  '#ffffff', // active slide left border
};

const SLIDE_CATALOG: { type: SlideType; label: string; group: string }[] = [
    { type: 'COVER',           label: 'Cover',            group: 'Éditorial' },
    { type: 'NEWS',            label: 'News Flash',       group: 'Éditorial' },
    { type: 'MANIFESTO',       label: 'Manifesto',        group: 'Éditorial' },
    { type: 'MAXTEXT',         label: 'Max Text',         group: 'Éditorial' },
    { type: 'GRANULAR',        label: 'Granular',         group: 'Éditorial' },
    { type: 'OUTRO',           label: 'Outro',            group: 'Éditorial' },
    { type: 'BIG_NUM',         label: 'Grand Chiffre',    group: 'Données' },
    { type: 'COMPARISON_CHART',label: 'Graphe Comparatif',group: 'Données' },
    { type: 'STACKED_DATA',    label: 'Données Empilées', group: 'Données' },
    { type: 'VOTE_TRACKER',    label: 'Vote Tracker',     group: 'Données' },
    { type: 'TERRITORY_RADAR', label: 'Radar Territoire', group: 'Données' },
    { type: 'VERSUS',          label: 'Pour/Contre',      group: 'Analyse' },
    { type: 'CHECKLIST',       label: 'Checklist',        group: 'Analyse' },
    { type: 'INFO',            label: 'Info',             group: 'Analyse' },
    { type: 'ANALYSIS',        label: 'Analyse',          group: 'Analyse' },
    { type: 'DECODING',        label: 'Décodage Politique',group: 'Analyse' },
    { type: 'CHRONO_LOCK',     label: 'Chronologie',      group: 'Analyse' },
    { type: 'IMPACT_QUOTE',    label: 'Citation Impact',  group: 'Analyse' },
    { type: 'SOCIAL_COST',     label: 'Coût Social',      group: 'Analyse' },
    { type: 'VIDEO_NOTE',      label: 'Note Vidéo',       group: 'Média' },
];

const GROUPS = ['Éditorial', 'Données', 'Analyse', 'Média'];

export function StudioSidebar() {
    const { 
        deck, activeId, setActiveId, activeSlide,
        addSlide, deleteSlide, moveSlide, renameSlide,
        aiLoading 
    } = useStudio();

    const [showAddMenu, setShowAddMenu] = useState(false);

    return (
        <aside style={{
            width: 240,
            background: T.bg,
            borderRight: `1px solid ${T.border}`,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* ── Section header ───────────────── */}
            <div style={{
                height: 40,
                borderBottom: `1px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                justifyContent: 'space-between',
                flexShrink: 0,
            }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Deck — {deck.length} slides
                </span>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowAddMenu(v => !v)}
                        style={{
                            width: 24, height: 24,
                            background: showAddMenu ? '#fff' : '#2a2a2a',
                            border: `1px solid ${showAddMenu ? '#fff' : T.borderMid}`,
                            color: showAddMenu ? '#000' : T.textMid,
                            fontSize: 16, fontWeight: 400,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 4,
                            lineHeight: 1,
                            transition: 'all 0.15s',
                        }}
                    >
                        +
                    </button>

                    {showAddMenu && (
                        <div style={{
                            position: 'absolute',
                            top: 30,
                            left: 0,
                            background: '#1a1a1a',
                            border: `1px solid ${T.border}`,
                            borderRadius: 6,
                            zIndex: 200,
                            width: 210,
                            maxHeight: '65vh',
                            overflowY: 'auto',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                        }}
                            className="sb"
                        >
                            {GROUPS.map(group => {
                                const items = SLIDE_CATALOG.filter(s => s.group === group);
                                return (
                                    <div key={group}>
                                        <div style={{ padding: '8px 14px 4px', borderTop: `1px solid ${T.border}` }}>
                                            <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                                {group}
                                            </span>
                                        </div>
                                        {items.map(item => (
                                            <button
                                                key={item.type}
                                                onClick={() => { addSlide(item.type); setShowAddMenu(false); }}
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '7px 16px',
                                                    fontSize: 12,
                                                    color: T.textMid,
                                                    fontFamily: 'Inter, system-ui, sans-serif',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    transition: 'background 0.1s',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.background = T.bgHover; e.currentTarget.style.color = T.textPrimary; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.textMid; }}
                                            >
                                                {item.label}
                                            </button>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Slide list ───────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} className="sb">
                {deck.map((slide, index) => {
                    const isActive = slide.id === activeId;
                    const tpl = getTemplate(slide.type);

                    return (
                        <div
                            key={slide.id}
                            onClick={() => setActiveId(slide.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px 8px 16px',
                                cursor: 'pointer',
                                background: isActive ? T.bgActive : 'transparent',
                                borderLeft: `2px solid ${isActive ? T.accentBar : 'transparent'}`,
                                transition: 'all 0.1s',
                                position: 'relative',
                            }}
                            className="slide-row group"
                            onMouseEnter={e => {
                                if (!isActive) e.currentTarget.style.background = T.bgHover;
                            }}
                            onMouseLeave={e => {
                                if (!isActive) e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            {/* Index */}
                            <span style={{ fontSize: 10, color: T.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 16, textAlign: 'right', flexShrink: 0 }}>
                                {(index + 1).toString().padStart(2, '0')}
                            </span>

                            {/* Label + type */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <input
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        outline: 'none',
                                        width: '100%',
                                        fontSize: 12,
                                        fontWeight: isActive ? 500 : 400,
                                        color: isActive ? T.textPrimary : T.textMid,
                                        fontFamily: 'Inter, system-ui, sans-serif',
                                        cursor: 'text',
                                        letterSpacing: '-0.01em',
                                    }}
                                    value={slide.label}
                                    onChange={e => renameSlide(slide.id, e.target.value)}
                                    onClick={e => e.stopPropagation()}
                                />
                                <div style={{ fontSize: 10, color: T.textMuted, marginTop: 1 }}>
                                    {tpl?.category ?? slide.type.replace(/_/g, ' ')}
                                </div>
                            </div>

                            {/* Actions (hover only) */}
                            <div className="slide-actions" style={{ display: 'none', gap: 2 }}>
                                <button
                                    onClick={e => { e.stopPropagation(); moveSlide(slide.id, -1); }}
                                    title="Monter"
                                    style={{ ...actionBtnStyle }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                                >↑</button>
                                <button
                                    onClick={e => { e.stopPropagation(); deleteSlide(slide.id); }}
                                    title="Supprimer"
                                    style={{ ...actionBtnStyle, color: '#888' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#2a1010'; e.currentTarget.style.color = '#ef4444'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
                                >✕</button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Footer ───────────────────────── */}
            <div style={{ borderTop: `1px solid ${T.border}`, padding: 12 }}>
                <button
                    disabled={aiLoading}
                    style={{
                        width: '100%',
                        background: '#222',
                        border: `1px solid ${T.borderMid}`,
                        color: aiLoading ? T.textMuted : T.textMid,
                        fontSize: 12,
                        fontWeight: 500,
                        padding: '8px 12px',
                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                        borderRadius: 4,
                        fontFamily: 'Inter, system-ui, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.color = T.textMid; }}
                >
                    {aiLoading && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'ping 1s infinite' }}></span>}
                    {aiLoading ? 'Génération en cours...' : '✦ Générer le deck avec l\'IA'}
                </button>
            </div>

            {/* Hover show slide actions */}
            <style>{`
                .slide-row:hover .slide-actions { display: flex !important; }
            `}</style>
        </aside>
    );
}

const actionBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    fontSize: 11,
    width: 22,
    height: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    flexShrink: 0,
    fontFamily: 'inherit',
};
