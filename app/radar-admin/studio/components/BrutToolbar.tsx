'use client';

import React, { useState, useRef, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────
// BRUT TOOLBAR (per canvas zone)
// ─────────────────────────────────────────────────────────────
export function BrutToolbar({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
    const [visible, setVisible] = useState(false);
    // Fixed viewport coords
    const [fixedLeft, setFixedLeft] = useState(0);
    const [fixedTop, setFixedTop] = useState(0);
    const savedRange = useRef<Range | null>(null);

    useEffect(() => {
        const onSel = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount) { setVisible(false); return; }
            const r = sel.getRangeAt(0);
            if (!containerRef.current?.contains(r.commonAncestorContainer)) { setVisible(false); return; }
            savedRange.current = r.cloneRange();
            const rRect = r.getBoundingClientRect();
            // Position toolbar above selection in *viewport* space
            setFixedLeft(rRect.left + rRect.width / 2);
            setFixedTop(rRect.top - 44);
            setVisible(true);
        };
        document.addEventListener('selectionchange', onSel);
        return () => document.removeEventListener('selectionchange', onSel);
    }, [containerRef]);

    const restore = () => {
        if (!savedRange.current) return;
        const s = window.getSelection(); s?.removeAllRanges(); s?.addRange(savedRange.current);
    };
    const cmd = (c: string) => { restore(); document.execCommand(c, false); };

    // Check if selection's direct parent span has a specific inline background
    const selectionHasBg = (rgbColor: string): boolean => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.getRangeAt(0).commonAncestorContainer;
        let el = (node.nodeType === Node.TEXT_NODE ? node.parentElement : node) as HTMLElement | null;
        while (el && el !== containerRef.current) {
            if (el.style?.backgroundColor.replace(/\s/g, '') === rgbColor.replace(/\s/g, '')) return true;
            el = el.parentElement;
        }
        return false;
    };

    // Toggle highlight: detect by walking up to nearest span with bg, remove or add
    const toggleHighlight = (rgbColor: string, textColor: string) => {
        restore();
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        // 1. Check if entirely inside a highlight we want to remove
        let current = range.commonAncestorContainer;
        let p = current.nodeType === Node.TEXT_NODE ? current.parentElement : current as HTMLElement | null;
        while (p && p !== containerRef.current) {
            if (p.style?.backgroundColor.replace(/\s/g, '') === rgbColor.replace(/\s/g, '')) {
                // Unwrap it!
                const parent = p.parentNode;
                if (parent) {
                    while (p.firstChild) parent.insertBefore(p.firstChild, p);
                    parent.removeChild(p);
                }
                containerRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
            p = p.parentElement;
        }

        // 2. Otherwise apply it
        const span = document.createElement('span');
        Object.assign(span.style, { backgroundColor: rgbColor, color: textColor, padding: '0 3px' });
        try { range.surroundContents(span); } catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
        containerRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const wrap = (style: Partial<CSSStyleDeclaration>) => {
        restore();
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) return;
        const range = sel.getRangeAt(0);
        const span = document.createElement('span');
        Object.assign(span.style, style);
        try { range.surroundContents(span); } catch { const f = range.extractContents(); span.appendChild(f); range.insertNode(span); }
        containerRef.current?.dispatchEvent(new Event('input', { bubbles: true }));
    };

    if (!visible) return null;
    return (
        <div className="brut-tb" style={{ left: fixedLeft, top: fixedTop }} onMouseDown={e => e.preventDefault()}>
            <button className="tb-btn" onClick={() => cmd('bold')}><b>B</b></button>
            <button className="tb-btn" onClick={() => cmd('italic')}><i>I</i></button>
            <button className="tb-btn" onClick={() => cmd('underline')}><u>U</u></button>
            <button className="tb-btn" onClick={() => wrap({ textDecoration: 'underline', textDecorationColor: '#DC2626', textDecorationThickness: '4px', textUnderlineOffset: '3px' })} title="Souligné militant">
                <span style={{ textDecoration: 'underline', textDecorationColor: '#DC2626', textDecorationThickness: '3px' }}>U</span>
            </button>
            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)', margin: '0 2px' }}></span>
            {/* Text colors */}
            <button className="tb-btn" onClick={() => wrap({ color: '#DC2626' })} title="Rouge"><span style={{ width: 12, height: 12, background: '#DC2626', display: 'block', border: '1px solid rgba(255,255,255,.3)' }}></span></button>
            <button className="tb-btn" onClick={() => wrap({ color: '#000' })} title="Noir"><span style={{ width: 12, height: 12, background: '#000', display: 'block', border: '1px solid rgba(255,255,255,.3)' }}></span></button>
            <button className="tb-btn" onClick={() => wrap({ color: '#fff' })} title="Blanc"><span style={{ width: 12, height: 12, background: '#fff', display: 'block', border: '1px solid rgba(0,0,0,.4)' }}></span></button>
            {/* Togglable highlights via explicit strict RGB */}
            <button className="tb-btn" onClick={() => toggleHighlight('rgb(220, 38, 38)', '#fff')} title="Surligné rouge (cliquer à nouveau pour enlever)">
                <span style={{ background: '#DC2626', color: '#fff', padding: '1px 4px', fontSize: 10, fontWeight: 700, border: selectionHasBg('rgb(220, 38, 38)') ? '2px solid #fff' : 'none' }}>A</span>
            </button>
            <button className="tb-btn" onClick={() => toggleHighlight('rgb(0, 0, 0)', '#fff')} title="Surligné noir (cliquer à nouveau pour enlever)">
                <span style={{ background: '#000', color: '#fff', padding: '1px 4px', fontSize: 10, fontWeight: 700, border: selectionHasBg('rgb(0, 0, 0)') ? '2px solid #DC2626' : 'none' }}>A</span>
            </button>
            <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,.1)', margin: '0 2px' }}></span>
            <select className="tb-sel" onChange={e => {
                const v = e.target.value;
                if (v === 'H') wrap({ fontWeight: '900', fontStyle: 'normal', fontSize: '48px', lineHeight: '.85', letterSpacing: '-.05em', textTransform: 'uppercase' });
                if (v === 'SH') wrap({ fontWeight: '700', fontStyle: 'italic', fontSize: '28px' });
                if (v === 'B') wrap({ fontWeight: '400', fontSize: '12px', fontStyle: 'normal' });
                if (v === 'BB') wrap({ fontWeight: '900', fontSize: '13px' });
                if (v === 'C') wrap({ fontWeight: '700', fontSize: '9px', letterSpacing: '.15em', textTransform: 'uppercase' });
                e.target.value = '';
            }} defaultValue="">
                <option value="" disabled>Style…</option>
                <option value="H">HEADING</option>
                <option value="SH">SUBHEAD</option>
                <option value="B">BODY</option>
                <option value="BB">BOLD</option>
                <option value="C">CAPTION</option>
            </select>
        </div>
    );
}
