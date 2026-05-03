'use client';

import React, { useState } from 'react';
import { useStudio, SlideType, Slide } from './StudioContext';
import { getTemplate } from '../registry';
import { Reorder, useDragControls } from 'framer-motion';

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
        deck, setDeck, activeId, setActiveId, activeSlide,
        addSlide, deleteSlide, moveSlide, renameSlide,
        aiLoading, isSwapped 
    } = useStudio();

    const [showAddMenu, setShowAddMenu] = useState(false);

    return (
        <aside style={{
            width: '100%',
            background: T.bg,
            borderRight: isSwapped ? 'none' : `1px solid ${T.border}`,
            borderLeft: isSwapped ? `1px solid ${T.border}` : 'none',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'visible', // Permettre au menu de sortir
            position: 'relative',
            zIndex: 50,
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* ── Section header ───────────────── */}
            <div style={{
                height: 44,
                borderBottom: `1px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                justifyContent: 'space-between',
                flexShrink: 0,
                background: '#111',
            }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Deck — {deck.length}
                </span>
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => setShowAddMenu(v => !v)}
                        className="active:scale-95 transition-all duration-150"
                        style={{
                            width: 28, height: 28,
                            background: showAddMenu ? '#fff' : '#222',
                            border: `1px solid ${showAddMenu ? '#fff' : T.borderMid}`,
                            color: showAddMenu ? '#000' : T.textMid,
                            fontSize: 18, fontWeight: 400,
                            cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 8,
                            lineHeight: 1,
                        }}
                    >
                        +
                    </button>

                    {showAddMenu && (
                        <div style={{
                            position: 'absolute',
                            top: 36,
                            left: isSwapped ? 'auto' : 0,
                            right: isSwapped ? 0 : 'auto',
                            background: '#1a1a1a',
                            border: `1px solid ${T.border}`,
                            borderRadius: 10,
                            zIndex: 1000,
                            width: 220,
                            maxHeight: '75vh',
                            overflowY: 'auto',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                            animation: 'modalIn 0.2s ease-out',
                        }}
                            className="sb"
                        >
                            {GROUPS.map(group => {
                                const items = SLIDE_CATALOG.filter(s => s.group === group);
                                return (
                                    <div key={group}>
                                        <div style={{ padding: '10px 14px 4px', borderTop: group !== GROUPS[0] ? `1px solid ${T.border}` : 'none' }}>
                                            <span style={{ fontSize: 9, fontWeight: 800, color: '#555', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                                                {group}
                                            </span>
                                        </div>
                                        {items.map(item => (
                                            <button
                                                key={item.type}
                                                onClick={() => { addSlide(item.type); setShowAddMenu(false); }}
                                                className="active:bg-white/10 transition-colors"
                                                style={{
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    padding: '8px 16px',
                                                    fontSize: 12,
                                                    color: T.textMid,
                                                    fontFamily: 'Inter, system-ui, sans-serif',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
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

            {/* ── Slide list (Drag & Drop enabled) ───────────────────── */}
            <Reorder.Group 
                axis="y" 
                values={deck} 
                onReorder={setDeck}
                style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }} 
                className="sb"
            >
                {deck.map((slide, index) => (
                    <SlideItem 
                        key={slide.id} 
                        slide={slide} 
                        index={index} 
                        isActive={slide.id === activeId}
                        onSelect={() => setActiveId(slide.id)}
                        onRename={renameSlide}
                        onDelete={deleteSlide}
                    />
                ))}
            </Reorder.Group>

            {/* ── Footer ───────────────────────── */}
            <div style={{ borderTop: `1px solid ${T.border}`, padding: 12, background: '#111' }}>
                <button
                    disabled={aiLoading}
                    className="active:scale-[0.98] transition-all duration-150"
                    style={{
                        width: '100%',
                        background: '#222',
                        border: `1px solid ${T.borderMid}`,
                        color: aiLoading ? T.textMuted : '#fff',
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '10px 12px',
                        cursor: aiLoading ? 'not-allowed' : 'pointer',
                        borderRadius: 8,
                        fontFamily: 'Inter, system-ui, sans-serif',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}
                    onMouseEnter={e => { if (!aiLoading) { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.background = '#282828'; } }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderMid; e.currentTarget.style.background = '#222'; }}
                >
                    {aiLoading && <span className="animate-ping w-2 h-2 rounded-full bg-white"></span>}
                    {aiLoading ? 'Génération...' : '✦ Générer le deck'}
                </button>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes modalIn {
                    from { opacity: 0; transform: translateY(-10px) scale(0.98); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .slide-row:hover .slide-actions { opacity: 1 !important; }
            ` }} />
        </aside>
    );
}

function SlideItem({ slide, index, isActive, onSelect, onRename, onDelete }: { 
    slide: Slide; index: number; isActive: boolean; onSelect: () => void; 
    onRename: (id: string, l: string) => void; onDelete: (id: string) => void;
}) {
    const tpl = getTemplate(slide.type);
    const controls = useDragControls();

    return (
        <Reorder.Item
            value={slide}
            dragListener={false}
            dragControls={controls}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 12px 4px 10px',
                cursor: 'pointer',
                background: isActive ? T.bgActive : 'transparent',
                borderLeft: `2px solid ${isActive ? T.accentBar : 'transparent'}`,
                position: 'relative',
                userSelect: 'none',
            }}
            className="slide-row group hover:bg-[#1a1a1a]"
            onPointerDown={onSelect}
        >
            {/* Drag Handle */}
            <div 
                onPointerDown={(e) => controls.start(e)}
                style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: '4px 2px' }}
                className="text-[#333] hover:text-[#666] transition-colors"
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
            </div>

            {/* Index */}
            <span style={{ fontSize: 9, color: T.textMuted, fontVariantNumeric: 'tabular-nums', minWidth: 14, textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>
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
                        fontWeight: isActive ? 600 : 400,
                        color: isActive ? T.textPrimary : T.textMid,
                        fontFamily: 'Inter, system-ui, sans-serif',
                        cursor: 'text',
                        letterSpacing: '-0.01em',
                    }}
                    value={slide.label}
                    onChange={e => onRename(slide.id, e.target.value)}
                    onPointerDown={e => e.stopPropagation()}
                />
                <div style={{ fontSize: 9, color: T.textMuted, marginTop: 0, opacity: 0.8, fontWeight: 500 }}>
                    {tpl?.category ?? slide.type.replace(/_/g, ' ')}
                </div>
            </div>

            {/* Actions (hover only) */}
            <div className="slide-actions flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={e => { e.stopPropagation(); onDelete(slide.id); }}
                    title="Supprimer"
                    className="active:scale-90"
                    style={{ ...actionBtnStyle, color: '#888' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#2a1010'; e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#888'; }}
                >✕</button>
            </div>
        </Reorder.Item>
    );
}

const actionBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: '#666',
    fontSize: 10,
    width: 20,
    height: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    flexShrink: 0,
    fontFamily: 'inherit',
    transition: 'all 0.15s',
};
