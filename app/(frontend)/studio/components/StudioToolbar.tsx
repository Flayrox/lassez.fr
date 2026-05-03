'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from './StudioContext';
import { DEFAULTS } from './constants';

export function StudioToolbar({ 
    onShowArticleModal, 
    onShowJsonImport, 
    onExportPNG, 
    onExportZIP,
    onExportJSON 
}: { 
    onShowArticleModal: () => void; 
    onShowJsonImport: () => void;
    onExportPNG: () => void;
    onExportZIP: () => void;
    onExportJSON: () => void;
}) {
    const { deck, setDeck, activeId, activeSlide, patchActive } = useStudio();
    const router = useRouter();

    if (!activeSlide) return <div className="h-12 bg-black border-b-2 border-zinc-800" />;

    const curAccent = activeSlide.state.accent || '#DC2626';

    const stripStyles = () => {
        const strip = (h: string) => {
            const d = document.createElement('div'); d.innerHTML = h;
            d.querySelectorAll<HTMLElement>('span,b,i,u,strong,em').forEach(el => {
                if (el.style?.backgroundColor) {
                    const bg = el.style.backgroundColor; el.removeAttribute('style'); el.style.backgroundColor = bg;
                } else { el.replaceWith(document.createTextNode(el.textContent || '')); }
            }); return d.innerHTML;
        };
        const s = activeSlide.state;
        const patch: any = {};
        if (s.headline) patch.headline = strip(s.headline);
        if (s.leadParagraph) patch.leadParagraph = strip(s.leadParagraph);
        if (s.bodyLeft) patch.bodyLeft = strip(s.bodyLeft);
        if (s.bodyRight) patch.bodyRight = strip(s.bodyRight);
        if (s.body) patch.body = strip(s.body);
        patchActive(patch);
    };

    const fullReset = () => {
        if (!confirm('Remettre cette slide à zéro ?')) return;
        setDeck(d => d.map(s => s.id === activeId ? { ...s, state: JSON.parse(JSON.stringify(DEFAULTS[s.type])) } : s));
    };

    return (
        <div className="h-12 bg-black border-b-2 flex items-center justify-between px-5 shrink-0 z-50" style={{ borderColor: curAccent }}>
            <div className="flex items-center gap-4">
                <div className="px-2 py-1 sm font-bold text-[10px] uppercase text-black" style={{ background: curAccent }}>✎ DECK STUDIO</div>
                <span className="sm text-[9px] opacity-35 hidden md:block uppercase">{deck.length} slide{deck.length > 1 ? 's' : ''}</span>
            </div>
            <div className="flex gap-2 items-center">
                <button onClick={onShowArticleModal}
                    className="sm text-[9px] px-3 py-1.5 border uppercase transition-colors" style={{ borderColor: `${curAccent}60`, color: curAccent }}>
                    ✨ IA Article → Deck
                </button>
                <button onClick={stripStyles} className="sm text-[9px] px-3 py-1.5 border border-white/10 hover:border-white/30 uppercase transition-colors" title="Reset styles (garde surlignages)">↺ Styles</button>
                <button onClick={fullReset} className="sm text-[9px] px-3 py-1.5 border border-red-900/40 text-red-500 hover:bg-red-900/20 uppercase transition-colors">✕ Reset</button>
                <span className="w-px h-4 bg-white/10 mx-1"></span>
                <button onClick={onShowJsonImport} className="sm text-[9px] px-3 py-1.5 border border-white/20 uppercase hover:border-white/50 transition-colors">↑ Importer JSON</button>
                <button onClick={onExportJSON} className="sm text-[9px] px-3 py-1.5 border border-white/20 uppercase hover:border-white/50 transition-colors">↓ Exporter JSON</button>
                <span className="w-px h-4 bg-white/10 mx-1"></span>
                <button onClick={onExportZIP} className="sm text-[9px] px-3 py-1.5 border border-white/20 uppercase hover:border-white/50 transition-colors">⇓ ZIP Tout</button>
                <button onClick={onExportPNG} className="sm text-[9px] font-bold px-4 py-1.5 text-black uppercase transition-colors" style={{ background: '#fff', boxShadow: `3px 3px 0 ${curAccent}` }}
                    onMouseEnter={e => { e.currentTarget.style.background = curAccent; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000'; }}>
                    ↓ Export PNG
                </button>
            </div>
        </div>
    );
}
