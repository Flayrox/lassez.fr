'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useStudio } from './StudioContext';
import { DEFAULTS } from './constants';

// ── Style tokens (Payload-inspired dark theme) ────────────────────────────
const T = {
    // Backgrounds
    bg:         '#1b1b1b',     // root bg
    bgNav:      '#0f0f0f',     // top nav
    bgHover:    '#252525',     // hover state
    // Borders
    border:     '#2a2a2a',     // default border
    borderMid:  '#3a3a3a',     // mid emphasis
    // Text
    textPrimary:'#ffffff',
    textMid:    '#aaaaaa',
    textMuted:  '#666666',
    // Accent
    accent:     '#ffffff',
    // Danger
    danger:     '#ef4444',
};

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

    if (!activeSlide) return (
        <div style={{ height: 52, background: T.bgNav, borderBottom: `1px solid ${T.border}` }} />
    );

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
        <div style={{
            height: 52,
            background: T.bgNav,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            gap: 0,
            flexShrink: 0,
            zIndex: 100,
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* Left — Brand + Nav */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1 }}>
                <button
                    onClick={() => router.push('/radar')}
                    className="active:scale-95 transition-transform duration-150"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
                >
                    <div style={{ width: 22, height: 22, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: 4 }}>
                        <div style={{ width: 8, height: 8, background: '#000' }}></div>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.02em' }}>Studio</span>
                </button>

                <div style={{ width: 1, height: 20, background: T.border, margin: '0 4px' }}></div>

                <button
                    onClick={onShowArticleModal}
                    className="active:scale-95 transition-all duration-150"
                    style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: '#252525', border: `1px solid ${T.border}`,
                        color: T.textMid, fontSize: 12, fontWeight: 600,
                        padding: '6px 14px', cursor: 'pointer',
                        borderRadius: 8, fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
                >
                    ✦ Générer avec l'IA
                </button>

                <button
                    onClick={onShowJsonImport}
                    className="active:opacity-70 transition-opacity"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textMuted, fontFamily: 'inherit', padding: '5px 8px' }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.textMid; }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.textMuted; }}
                >
                    Importer JSON
                </button>
            </div>

            {/* Center — deck count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, background: '#1a1a1a', padding: '2px 10px', borderRadius: 20, border: `1px solid ${T.border}` }}>
                    {deck.length} slide{deck.length > 1 ? 's' : ''}
                </span>
            </div>

            {/* Right — Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                <button
                    onClick={stripStyles}
                    title="Nettoyer les styles de texte"
                    className="active:scale-95 transition-all duration-150"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textMuted, fontFamily: 'inherit', padding: '6px 10px', borderRadius: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.bgHover; e.currentTarget.style.color = T.textMid; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.textMuted; }}
                >
                    Nettoyer styles
                </button>
                <button
                    onClick={fullReset}
                    title="Reset la slide active"
                    className="active:scale-95 transition-all duration-150"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: T.textMuted, fontFamily: 'inherit', padding: '6px 10px', borderRadius: 6 }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#2a1a1a'; e.currentTarget.style.color = T.danger; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = T.textMuted; }}
                >
                    Reset slide
                </button>

                <div style={{ width: 1, height: 20, background: T.border, margin: '0 4px' }}></div>

                <button
                    onClick={onExportJSON}
                    className="active:scale-95 transition-all duration-150"
                    style={{
                        background: '#252525', border: `1px solid ${T.border}`,
                        color: T.textMid, fontSize: 12, fontWeight: 600,
                        padding: '6px 14px', cursor: 'pointer',
                        borderRadius: 8, fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
                >
                    JSON
                </button>
                <button
                    onClick={onExportZIP}
                    className="active:scale-95 transition-all duration-150"
                    style={{
                        background: '#252525', border: `1px solid ${T.border}`,
                        color: T.textMid, fontSize: 12, fontWeight: 600,
                        padding: '6px 14px', cursor: 'pointer',
                        borderRadius: 8, fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.color = T.textMid; }}
                >
                    ZIP
                </button>
                <button
                    onClick={onExportPNG}
                    className="active:scale-95 transition-all duration-150"
                    style={{
                        background: '#ffffff', color: '#000',
                        border: 'none', fontSize: 12, fontWeight: 700,
                        padding: '7px 18px', cursor: 'pointer',
                        borderRadius: 8, fontFamily: 'inherit',
                        transition: 'background 0.15s',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#e0e0e0'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#ffffff'; }}
                >
                    ↓ Export PNG
                </button>
            </div>
        </div>
    );
}
