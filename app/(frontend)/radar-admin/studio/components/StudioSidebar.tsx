'use client';

import React, { useState } from 'react';
import { useStudio, SlideType } from './StudioContext';
import { ICONS } from './constants';

function F({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="space-y-1"><p className="sm text-[9px] uppercase tracking-widest text-gray-600">{label}</p>{children}</div>;
}

export function StudioSidebar() {
    const { 
        deck, activeId, setActiveId, activeSlide, patchActive, 
        addSlide, duplicateSlide, deleteSlide, moveSlide, renameSlide,
        aiLoading 
    } = useStudio();
    
    const [showAddMenu, setShowAddMenu] = useState(false);

    if (!activeSlide) return <aside className="w-72 border-r border-white/10 bg-[#0d0d0d]" />;

    const { type: template, state: activeState } = activeSlide;
    const curAccent = activeState.accent || '#DC2626';

    const patch = (p: any) => patchActive(p);

    const SLIDE_TYPES: SlideType[] = [
        'COVER', 'NEWS', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'INFO', 'ANALYSIS', 'OUTRO', 
        'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 
        'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'
    ];

    return (
        <aside className="w-72 border-r border-white/10 bg-[#0d0d0d] flex flex-col shrink-0 overflow-hidden">
            {/* ── Slide List ──────────────────── */}
            <div className="border-b border-white/10 p-3 shrink-0">
                <div className="flex justify-between items-center mb-2">
                    <span className="sm text-[9px] uppercase tracking-widest text-gray-500">Deck — {deck.length} slides</span>
                    <div className="relative">
                        <button onClick={() => setShowAddMenu(v => !v)}
                            className="sm text-[9px] px-2 py-1 font-bold uppercase text-black"
                            style={{ background: curAccent }}>+ Slide</button>
                        {showAddMenu && (
                            <div className="absolute right-0 top-7 bg-black border border-white/10 z-50 min-w-[175px] max-h-72 overflow-y-auto sb" style={{ boxShadow: `4px 4px 0 ${curAccent}` }}>
                                {SLIDE_TYPES.map(t => (
                                    <button key={t} onClick={() => { addSlide(t); setShowAddMenu(false); }}
                                        className="w-full text-left sm text-[9px] px-3 py-2 uppercase hover:bg-white/5 flex items-center gap-2">
                                        <span>{ICONS[t]}</span>{t.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto sb">
                    {deck.map((slide) => (
                        <div key={slide.id}
                            className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer rounded-sm transition-colors group ${slide.id === activeId ? 'bg-white/10' : 'hover:bg-white/5'
                                }`}
                            onClick={() => setActiveId(slide.id)} style={slide.id === activeId ? { borderLeft: `2px solid ${curAccent}` } : { borderLeft: '2px solid transparent' }}>
                            <span className="text-sm shrink-0">{ICONS[slide.type]}</span>
                            <input
                                className="flex-1 bg-transparent border-none outline-none sm text-[9px] uppercase truncate"
                                value={slide.label}
                                onChange={e => renameSlide(slide.id, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                style={{ color: slide.id === activeId ? '#fff' : '#666' }}
                            />
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button title="Monter" onClick={e => { e.stopPropagation(); moveSlide(slide.id, -1); }} className="sm text-[9px] text-gray-500 hover:text-white px-1">↑</button>
                                <button title="Descendre" onClick={e => { e.stopPropagation(); moveSlide(slide.id, 1); }} className="sm text-[9px] text-gray-500 hover:text-white px-1">↓</button>
                                <button title="Dupliquer" onClick={e => { e.stopPropagation(); duplicateSlide(slide.id); }} className="sm text-[9px] text-gray-500 hover:text-white px-1">⧉</button>
                                <button title="Supprimer" onClick={e => { e.stopPropagation(); deleteSlide(slide.id); }} className="sm text-[9px] text-red-700 hover:text-red-400 px-1">✕</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Controls for active slide ─────── */}
            <div className="flex-1 overflow-y-auto sb p-4 space-y-5">
                {template === 'COVER' && (
                    <section className="space-y-3">
                        <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                        <F label="Marque"><input className="si" value={activeState.brand} onChange={e => patch({ brand: e.target.value })} /></F>
                        <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={activeState.accent} onChange={e => patch({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={activeState.accent} onChange={e => patch({ accent: e.target.value })} /></div></F>
                        <F label="Fond canvas"><div className="flex gap-2"><input type="color" value={activeState.bg} onChange={e => patch({ bg: e.target.value })} className="w-8 h-7 shrink-0" /><input className="si flex-1" value={activeState.bg} onChange={e => patch({ bg: e.target.value })} /></div></F>
                        <F label="Image URL"><input className="si" value={activeState.imageUrl} onChange={e => patch({ imageUrl: e.target.value })} /></F>
                        <div className="grid grid-cols-2 gap-2">
                            <F label="Zoom"><input type="range" min="0.5" max="3" step="0.05" value={activeState.zoom} onChange={e => patch({ zoom: parseFloat(e.target.value) })} /></F>
                            <F label="Gris"><input type="range" min="0" max="100" value={activeState.grayscale} onChange={e => patch({ grayscale: parseInt(e.target.value) })} /></F>
                        </div>
                    </section>
                )}

                {template === 'NEWS' && (
                    <section className="space-y-3">
                        <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Contenu</p>
                        <F label="Catégorie"><input className="si" value={activeState.category} onChange={e => patch({ category: e.target.value })} /></F>
                        <F label="Sujet"><input className="si" value={activeState.topic} onChange={e => patch({ topic: e.target.value })} /></F>
                        <F label="Date"><input className="si" value={activeState.date} onChange={e => patch({ date: e.target.value })} /></F>
                        <F label="Image URL"><input className="si" value={activeState.imageUrl} onChange={e => patch({ imageUrl: e.target.value })} /></F>
                        <div className="grid grid-cols-2 gap-2">
                            <F label="Zoom"><input type="range" min="0.5" max="3" step="0.05" value={activeState.zoom} onChange={e => patch({ zoom: parseFloat(e.target.value) })} /></F>
                            <F label="Gris"><input type="range" min="0" max="100" value={activeState.grayscale} onChange={e => patch({ grayscale: parseInt(e.target.value) })} /></F>
                        </div>
                    </section>
                )}

                {template === 'VIDEO_NOTE' && (
                    <section className="space-y-3">
                        <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Vidéo</p>
                        <F label="Lien vidéo (MP4 ou YT)"><input className="si" value={activeState.videoUrl} onChange={e => patch({ videoUrl: e.target.value })} /></F>
                        <F label="Zoom Vidéo"><input type="range" min="0.5" max="3" step="0.05" value={activeState.videoZoom || 1} onChange={e => patch({ videoZoom: parseFloat(e.target.value) })} /></F>
                        <p className="sm text-[8px] text-gray-500 uppercase leading-tight italic">Drag & drop la vidéo directement sur le canvas pour l'ajuster.</p>
                    </section>
                )}

                {/* More template controls can be added here following the same pattern */}
                
                <section className="pt-4 border-t border-white/5">
                    <p className="sm text-[8px] text-gray-600 uppercase">Astuce: Utilise la barre d'outils flottante sur le canvas pour formater le texte.</p>
                </section>
            </div>
        </aside>
    );
}
