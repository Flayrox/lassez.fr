'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toPng } from 'html-to-image';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// ─────────────────────────────────────────────────────────────
// GLOBAL CSS
// ─────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Inter:wght@400;700;900&family=Space+Mono:wght@400;700&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,700&family=Space+Grotesk:wght@300;400;500;600;700&display=swap');
.sg{font-family:'Space Grotesk',sans-serif}.pd{font-family:'Playfair Display',serif}.ab{font-family:'Archivo Black',sans-serif}.ir{font-family:'Inter',sans-serif}.sm{font-family:'Space Mono',monospace}
.edit-zone{position:relative}
.edit-overlay{position:absolute;inset:0;border:2px dashed #DC2626;opacity:0;pointer-events:none;z-index:50;transition:opacity .15s}
.edit-zone:hover .edit-overlay,.edit-zone:focus-within .edit-overlay{opacity:1}
.edit-zone:focus-within .edit-overlay{border-style:solid}
.edit-sticker{position:absolute;background:#000;color:#fff;padding:2px 5px;font-family:'Space Mono',monospace;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:3px;z-index:60;border:1px solid rgba(255,255,255,0.15);cursor:pointer}
.edit-sticker:hover{background:#fff;color:#000}
.edit-zone:focus-within .edit-sticker{background:#DC2626;color:#fff}
.edit-zone:focus-within .edit-sticker:hover{background:#fff;color:#000}
[contenteditable]{outline:none}
.brut-tb{position:fixed;transform:translateX(-50%);background:#0a0a0a;border:1px solid rgba(255,255,255,0.2);display:flex;align-items:center;height:34px;z-index:9999;white-space:nowrap;box-shadow:4px 4px 0 rgba(220,38,38,.35)}
.brut-tb::after{content:'';position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:rgba(255,255,255,.2)}
.tb-btn{height:100%;padding:0 8px;background:transparent;border:none;border-right:1px solid rgba(255,255,255,.1);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .1s;font-family:'Space Mono',monospace;font-size:11px;font-weight:700}
.tb-btn:last-child{border-right:none}.tb-btn:hover{background:rgba(220,38,38,.65)}
.tb-sel{height:100%;padding:0 6px;background:#111;border:none;border-right:1px solid rgba(255,255,255,.1);color:#fff;font-family:'Space Mono',monospace;font-size:9px;cursor:pointer;outline:none}
.halftone{background-image:radial-gradient(circle,#000 1px,transparent 1.5px);background-size:4px 4px;pointer-events:none}
/* noise-overlay uses a real PNG base64 because html2canvas ignores SVG <feTurbulence> */
.noise-overlay{position:absolute;inset:0;pointer-events:none;z-index:40;opacity:0.25;background-image:url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyBAMAAADsEZWCAAAAGFBMVEUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/HlFvAAAABnRSTlMAf0D/2t91y7UCAAAAfklEQVQ4y2NgQAX8DIwgwsDAwMgAkkLUA0QhSoEUgyIjyEAQxagIVw2imKxAMphqEMVMCpC0M1QxSCxIM0gxyFIIZpCokGZwaRCwAqkGiQkJK+BSyMogxSDNICEh0QBRDKYaxKQQzCBRIdUgmEFiQZpBqkH8AhgIqQUAP/1l+9b3w9YAAAAASUVORK5CYII=");background-repeat:repeat;background-size:64px 64px;}
.split-bg{background:linear-gradient(to right,#fff 50%,#e5e5e5 50%)}
.sb::-webkit-scrollbar{width:4px}.sb::-webkit-scrollbar-track{background:#0a0a0a}.sb::-webkit-scrollbar-thumb{background:#333}.sb::-webkit-scrollbar-thumb:hover{background:var(--ac)}
.si{width:100%;background:#111;border:1px solid rgba(255,255,255,.1);color:#fff;font-size:11px;padding:5px 7px;outline:none;transition:border-color .15s;font-family:'Space Grotesk',sans-serif}.si:focus{border-color:var(--ac)}
input[type=range]{-webkit-appearance:none;appearance:none;background:#2a2a2a;height:3px;border-radius:2px;outline:none;width:100%}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;height:13px;width:13px;background:#fff;border:2px solid var(--ac,#DC2626);border-radius:50%;cursor:pointer}
.maxtext-body ul,.maxtext-body ol{list-style:none;padding-left:0;margin:4px 0}
.maxtext-body li::before{content:'■';color:#DC2626;font-weight:900;margin-right:5px}
`;

// ─────────────────────────────────────────────────────────────
// BRUT TOOLBAR (per canvas zone)
// ─────────────────────────────────────────────────────────────
function BrutToolbar({ containerRef }: { containerRef: React.RefObject<HTMLElement | null> }) {
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

// ─────────────────────────────────────────────────────────────
// EDITABLE ZONE
// ─────────────────────────────────────────────────────────────
function EditZone({ html, onChange, label = 'EDIT', className, style, stickerPos = '-top-4 left-0' }: {
    html: string; onChange: (h: string) => void;
    label?: string; className?: string; style?: React.CSSProperties; stickerPos?: string;
}) {
    const zoneRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (zoneRef.current && !zoneRef.current.contains(document.activeElement) && zoneRef.current.innerHTML !== html)
            zoneRef.current.innerHTML = html;
    }, [html]);
    return (
        <div className="edit-zone" style={{ position: 'relative' }}>
            <BrutToolbar containerRef={zoneRef} />
            <div className="edit-overlay"></div>
            <div className={`edit-sticker ${stickerPos}`} onClick={() => zoneRef.current?.focus()}>✎ {label}</div>
            <div ref={zoneRef} contentEditable suppressContentEditableWarning className={className} style={style}
                onInput={() => { if (zoneRef.current) onChange(zoneRef.current.innerHTML); }} />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// IMAGE DRAGGER
// Uses absolute width/height + left/top instead of transform:scale
// so html2canvas captures exact dimensions & position
// ─────────────────────────────────────────────────────────────
function DraggableImage({ src, zoom, grayscale, posX, posY, onPosChange }: {
    src: string; zoom: number; grayscale: number;
    posX: number; posY: number; onPosChange: (x: number, y: number) => void;
}) {
    const isDragging = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        startMouse.current = { x: e.clientX, y: e.clientY };
        startPos.current = { x: posX, y: posY };
        e.preventDefault();
    };
    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - startMouse.current.x;
            const dy = e.clientY - startMouse.current.y;
            onPosChange(startPos.current.x + dx, startPos.current.y + dy);
        };
        const onUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [onPosChange]);

    const filter = `grayscale(${grayscale / 100}) contrast(${1 + (grayscale / 100) * 0.5}) brightness(${1 - (grayscale / 100) * 0.25})`;
    // Size based on zoom: zoom=1 → 100%, zoom=2 → 200% etc.
    const sz = `${zoom * 100}%`;
    // Center it then apply pixel offset
    const left = `calc(${(1 - zoom) * 50}% + ${posX}px)`;
    const top = `calc(${(1 - zoom) * 50}% + ${posY}px)`;

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'absolute',
                width: sz, height: sz,
                left, top,
                filter,
                cursor: 'grab',
            }}
        >
            <img
                crossOrigin="anonymous" alt="" src={src} draggable={false}
                style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    userSelect: 'none',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}

function DraggableVideo({ src, zoom, posX, posY, onPosChange }: {
    src: string; zoom: number;
    posX: number; posY: number; onPosChange: (x: number, y: number) => void;
}) {
    const isDragging = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    const onMouseDown = (e: React.MouseEvent) => {
        isDragging.current = true;
        startMouse.current = { x: e.clientX, y: e.clientY };
        startPos.current = { x: posX, y: posY };
        e.preventDefault();
        e.stopPropagation();
    };

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const dx = e.clientX - startMouse.current.x;
            const dy = e.clientY - startMouse.current.y;
            onPosChange(startPos.current.x + dx, startPos.current.y + dy);
        };
        const onUp = () => { isDragging.current = false; };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [onPosChange]);

    const sz = `${zoom * 100}%`;
    const left = `calc(${(1 - zoom) * 50}% + ${posX}px)`;
    const top = `calc(${(1 - zoom) * 50}% + ${posY}px)`;

    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'absolute',
                width: sz, height: sz,
                left, top,
                cursor: 'grab',
            }}
        >
            <video
                src={src} autoPlay muted loop
                style={{
                    width: '100%', height: '100%',
                    objectFit: 'cover',
                    userSelect: 'none',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────
// PER-TEMPLATE STATE SHAPE  
// ─────────────────────────────────────────────────────────────
interface CoverState {
    headline: string; brand: string; accent: string; bg: string;
    imageUrl: string; zoom: number; posX: number; posY: number; grayscale: number;
    issueNum: string; readTime: string; author: string; swipeLabel: string;
}
interface NewsState {
    headline: string; brand: string; accent: string;
    imageUrl: string; zoom: number; posX: number; posY: number; grayscale: number;
    category: string; date: string; topic: string;
}
interface ManifestoState {
    headline: string; brand: string; accent: string;
    docNum: string; titleSize: number;
    bodyLeft: string; bodyRight: string;
    metaLeft: string; metaRight: string; actionLabel: string;
}
interface MaxTextState {
    headline: string; brand: string; accent: string;
    tag: string; date: string; source: string;
    leadParagraph: string; bodyParagraph: string; quote: string; quoteAuthor: string;
    showQuote: boolean; showDate: boolean; showSource: boolean;
}
interface GranularState {
    headline: string; brand: string; accent: string;
    tag: string; slideNum: string;
    body: string; bodyMono: string; quote: string;
    footerHandle: string; dark: boolean;
}
interface BigNumState {
    headline: string; num: string; label: string; sub: string;
    brand: string; accent: string; dark: boolean;
}
interface VersusState {
    headline: string; leftTitle: string; leftBody: string;
    rightTitle: string; rightBody: string;
    brand: string; accent: string;
}
interface ChecklistState {
    headline: string;
    item1: string; item2: string; item3: string; item4: string;
    check1: boolean; check2: boolean; check3: boolean; check4: boolean;
    brand: string; accent: string;
}
interface InfoState {
    headline: string; brand: string; accent: string;
    tag: string; slideNum: string;
    body: string; bodyMono: string;
    actionTitle: string; actionMeta: string;
    footerHandle: string;
}
interface AnalysisState {
    headline: string; brand: string; accent: string;
    refCode: string; slideNum: string; totalSlides: string;
    item1Num: string; item1Title: string; item1Text: string;
    item2Num: string; item2Title: string; item2Text: string;
    item3Num: string; item3Title: string; item3Text: string;
    imageUrl: string; zoom: number; posX: number; posY: number; grayscale: number;
}
interface OutroState {
    headline: string; brandHandle: string; accent: string;
    linkText: string; footerYear: string; number: string;
}
// ─── NEW DATA INFOGRAPHIC TYPES ───────────────────────────────
interface ComparisonBar { label: string; value: number; color: string; }
interface ComparisonChartState {
    headline: string; subheadline: string; category: string;
    bars: ComparisonBar[];
    source: string; brand: string; accent: string;
}
interface StackedColumn { label: string; color: string; }
interface StackedCell { value: number; label: string; }
interface StackedRow { sector: string; cells: StackedCell[]; }
interface StackedDataState {
    headline: string; subheadline: string;
    columns: StackedColumn[];
    rows: StackedRow[];
    source: string; brand: string; accent: string;
}
interface VoteRow { law: string; vote: 'POUR' | 'CONTRE' | 'ABST'; }
interface VoteTrackerState {
    title: string; subtitle: string; subjectName: string;
    imageUrl: string;
    votes: VoteRow[];
    variant: string;
    brand: string; accent: string;
    colorPour: string; colorContre: string; colorAbst: string;
}
// ─── TERRITORY RADAR ───────────────────────────────────────────
interface TerritoryLegend { color: string; label: string; }
interface TerritoryStat { label: string; value: string; }
interface TerritoryRadarState {
    headline: string; subheadline: string;
    svgContent: string; // raw inline SVG or placeholder
    legend: TerritoryLegend[];
    stats: TerritoryStat[];
    source: string; brand: string; accent: string;
}
// ─── DECODING ───────────────────────────────────────────────────
interface DecodingState {
    headline: string;
    jargonTerm: string;
    officialDef: string;
    realityCheck: string;
    brand: string; accent: string;
}
// ─── CHRONO LOCK ────────────────────────────────────────────────
interface TimelineEvent { date: string; event: string; impact: string; }
interface ChronoLockState {
    headline: string; subheadline: string;
    timeline: TimelineEvent[];
    brand: string; accent: string;
}
// ─── IMPACT QUOTE ───────────────────────────────────────────────
interface ImpactQuoteState {
    largeQuote: string;
    author: string;
    context: string;
    brand: string; accent: string;
}
// ─── SOCIAL COST ────────────────────────────────────────────────
interface SocialCostState {
    headline: string;
    targetAudience: string;
    monthlyLoss: string;
    annualImpact: string;
    consequence: string;
    note: string;
    brand: string; accent: string;
}
// ─── VIDEO NOTE ─────────────────────────────────────────────────
interface VideoNoteState {
    videoUrl: string;
    annotation: string;
    headline: string;
    brand: string; accent: string;
    videoZoom: number;
    videoX: number;
    videoY: number;
}

const DC: CoverState = {
    headline: "LE SILENCE<br/>EST UNE<br/>ARME", brand: "L'ASSEZ", accent: "#DC2626", bg: "#fff",
    imageUrl: "https://lh3.googleusercontent.com/aida-public/AB6AXuAYQs_IRJLcx1it7NC4hR0QXtIILNoiLW-u-cYTe8GLXdw6Lc_ins-9agVfxVrUpSJCChGeJ64lty3mYBYYAL7AlTpr9LABDjoAyjXoATOwfe3UO8g4PVOclVjPlE9pgbedCPE0tiX-BYKdTfosIdwa1K8QFGvo2C16w6_OKw6DTJD-PnO0bJEF5L-Y4w7g7i1BVRoXsSrtOp_5ZgKXBYp0G_3xRmn9WLBsGVPpoMu27G9J7Vt4uJXZNXqW1EIxdrr3HE7GNHi3t3UN",
    zoom: 1.2, posX: 0, posY: 0, grayscale: 100,
    issueNum: "042", readTime: "3 min", author: "L'Assez", swipeLabel: "Glisser",
};
const DN: NewsState = {
    headline: "L'accord sur le<br/><em style=\"color:#DC2626\">Climat</em> s'effondre", brand: "L'ASSEZ", accent: "#DC2626",
    imageUrl: DC.imageUrl, zoom: 1.2, posX: 0, posY: 0, grayscale: 100,
    category: "FLASH", date: "24.10.2023", topic: "Actualité",
};
const DM: ManifestoState = {
    headline: "L'Illusion<br/>du Choix", brand: "L'ASSEZ", accent: "#DC2626",
    docNum: "Dossier-02", titleSize: 40,
    bodyLeft: "On nous présente les options A et B — mais <strong>l'infrastructure</strong> qui les soutient reste inchangée. Ce n'est pas un accident ; c'est une caractéristique de conception du système.",
    bodyRight: "La promesse de réforme est <span style=\"text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:4px\">l'opium du peuple</span> à l'ère numérique. Nous scrollons, nous cliquons, nous nous pensons informés.",
    metaLeft: "ÉCHEC CRITIQUE", metaRight: "Ne détournez pas le regard.", actionLabel: "Action Requise",
};
const DMX: MaxTextState = {
    headline: "Révélations sur les failles systémiques de l'audit", brand: "L'ASSEZ", accent: "#DC2626",
    tag: "Enquête", date: "12.04.2023", source: "Fuite interne #892",
    leadParagraph: `Les audits récents ont révélé une tendance inquiétante. Plus de <span style="background:#000;color:#fff;padding:0 3px;font-weight:700">60%</span> des fonds de secours n'ont jamais atteint les populations concernées. Ces ressources ont été absorbées par des coûts administratifs opaques.`,
    bodyParagraph: "Il ne s'agit pas de simple inefficacité bureaucratique, mais d'un mechanism structurel conçu pour masquer les responsabilités au plus haut niveau de décision.",
    quote: '"On nous a promis des infrastructures. On nous a donné des communiqués."',
    quoteAuthor: "— Porte-parole, Quartier Sud-Est",
    showQuote: true, showDate: true, showSource: true,
};
const DGS: GranularState = {
    headline: "ÉCHEC<br/>SYSTÉMIQUE", brand: "L'ASSEZ", accent: "#DC2626",
    tag: "Flash Info", slideNum: "02",
    body: `Les nouvelles données révèlent que plus de <span style="background:#000;color:#fff;padding:0 3px;font-weight:700">60% des fonds</span> n'ont jamais atteint les populations.`,
    bodyMono: "Malgré les engagements publics, la traçabilité s'arrête net aux frais administratifs. Ce n'est pas une erreur, c'est le fonctionnement normal du système.",
    quote: '"Ils ont signé les papiers alors que tout brûlait encore. Personne ne comptait reconstruire."',
    footerHandle: "@LASSEZmedia",
    dark: false,
};
const DIS: InfoState = {
    headline: "DÉCORTIQUER<br/>LE SYSTÈME", brand: "L'ASSEZ", accent: "#DC2626",
    tag: "Flash Info", slideNum: "02",
    body: `L'audit confirme que plus de <span style="background:#000;color:#fff;padding:0 4px;text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px;font-weight:700">60% des promesses</span> sont restées lettre morte.`,
    bodyMono: "L'analyse montre que ce mécanisme d'opacité est délibérément intégré dans la loi pour protéger les profits au détriment du service public.",
    actionTitle: "Action Requise Immédiate",
    actionMeta: "Dossier #12.04 — Secteur 4",
    footerHandle: "@LASSEZmedia",
};
const DAN: AnalysisState = {
    headline: "L'Assez Analysis", brand: "L'ASSEZ", accent: "#DC2626",
    refCode: "Ref: 24-0B // V.02", slideNum: "02", totalSlides: "10",
    item1Num: "01", item1Title: "Redondance Systémique", item1Text: "L'architecture actuelle priorise des protocoles obsolètes.",
    item2Num: "02", item2Title: "Biais Algorithmique", item2Text: "Les flux d'information sont bridés par des gardiens opaques.",
    item3Num: "03", item3Title: "Extraction des Ressources", item3Text: "L'attention est la matière première principale.",
    imageUrl: DC.imageUrl, zoom: 1.0, posX: 0, posY: 0, grayscale: 100,
};
const DOU: OutroState = {
    headline: `<span class="block relative">S'A<span class="absolute -top-4 -right-4 text-4xl text-white dark:text-black font-grotesk animate-bounce">*</span></span><span class="block ml-12">BON</span><span class="block -ml-8">NER</span>`,
    brandHandle: "@L_ASSEZ_MEDIA", accent: "#DC2626",
    linkText: "Lien en bio", footerYear: "EST. 2024", number: "04",
};

// ─────────────────────────────────────────────────────────────
// FIELD
// ─────────────────────────────────────────────────────────────
function F({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="space-y-1"><p className="sm text-[9px] uppercase tracking-widest text-gray-600">{label}</p>{children}</div>;
}

// ─────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────
export default function StudioPage() {
    return (
        <React.Suspense fallback={<div className="h-screen bg-black" />}>
            <StudioPageContent />
        </React.Suspense>
    );
}

function StudioPageContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const postId = searchParams.get('id');
    const [loading, setLoading] = useState(!!postId);

    // ── DECK model ───────────────────────────
    type SlideType = 'COVER' | 'NEWS' | 'MANIFESTO' | 'MAXTEXT' | 'GRANULAR' | 'BIG_NUM' | 'VERSUS' | 'CHECKLIST' | 'INFO' | 'ANALYSIS' | 'OUTRO' | 'COMPARISON_CHART' | 'STACKED_DATA' | 'VOTE_TRACKER' | 'TERRITORY_RADAR' | 'DECODING' | 'CHRONO_LOCK' | 'IMPACT_QUOTE' | 'SOCIAL_COST' | 'VIDEO_NOTE';
    type AnyState = CoverState | NewsState | ManifestoState | MaxTextState | GranularState | BigNumState | VersusState | ChecklistState | InfoState | AnalysisState | OutroState | ComparisonChartState | StackedDataState | VoteTrackerState | TerritoryRadarState | DecodingState | ChronoLockState | ImpactQuoteState | SocialCostState | VideoNoteState;
    interface Slide { id: string; type: SlideType; label: string; state: AnyState; }

    const DEFAULTS: Record<SlideType, AnyState> = {
        COVER: DC, NEWS: DN, MANIFESTO: DM, MAXTEXT: DMX, GRANULAR: DGS,
        BIG_NUM: { headline: "L'IMPACT EN CHIFFRES", num: "80%", label: "DES PROFITS", sub: "absorbés par les 1% les plus riches en 2023.", brand: "L'ASSEZ", accent: "#DC2626", dark: true },
        VERSUS: { headline: "DISCOURS VS RÉALITÉ", leftTitle: "CE QU'ILS DISENT", leftBody: "La sobriété est l'affaire de tous les citoyens.", rightTitle: "LA RÉALITÉ", rightBody: "Les vols en jets privés ont augmenté de 20% cette année.", brand: "L'ASSEZ", accent: "#DC2626" },
        CHECKLIST: { headline: "COMMENT AGIR ?", item1: "Désamorcer le récit officiel", item2: "Soutenir les médias indépendants", item3: "Rejoindre un collectif local", item4: "Partager l'information", check1: true, check2: false, check3: false, check4: false, brand: "L'ASSEZ", accent: "#DC2626" },
        INFO: DIS, ANALYSIS: DAN, OUTRO: DOU,
        COMPARISON_CHART: {
            headline: "INFRACTIONS & CANDIDATS", subheadline: "COMPARATIF BRUTAL : PARTIS & PROPOS SIGNALÉS",
            category: "L'ASSEZ INVESTIGATION",
            bars: [
                { label: "AUTRES PARTIS*", value: 0, color: "#888" },
                { label: "DIVERS DROITE", value: 1, color: "#555" },
                { label: "DIVERS GAUCHE", value: 4, color: "#333" },
                { label: "RASSEMBLEMENT NATIONAL", value: 139, color: "#BC0100" },
            ],
            source: "Source : Analyse brute L'Assez & Bon Pote (Villes Futures), Mediapart, Libé.",
            brand: "L'ASSEZ", accent: "#BC0100",
        } as ComparisonChartState,
        STACKED_DATA: {
            headline: "L'INFOGRAPHIE BRUTE DES DISCRIMINATIONS SYSTÉMIQUES",
            subheadline: "ANALYSE DES INCIDENTS SIGNALÉS ET DES RÉPONSES INSTITUTIONNELLES (2023-2024)",
            columns: [
                { label: "RACISME", color: "#BC0100" },
                { label: "ANTISÉMITISME", color: "#7A0000" },
                { label: "SEXISME / HOMOPHOBIE", color: "#1A1A1A" },
                { label: "VIOLENCES / HARCÈLEMENT", color: "#555" },
                { label: "DISCRIMINATION", color: "#999" },
            ],
            rows: [
                { sector: "SECTEUR PUBLIC", cells: [{ value: 512, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
                { sector: "ENTREPRISES PRIVÉES", cells: [{ value: 408, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
                { sector: "ÉDUCATION", cells: [{ value: 366, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 276, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 79, label: "DISCRIMINATION" }] },
                { sector: "LOGEMENT SOCIAL", cells: [{ value: 446, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
            ],
            source: "SOURCE: L'ASSEZ ENQUÊTES & DONNÉES BRUTES. TOUS DROITS RÉSERVÉS. ÉDITION 2024.",
            brand: "L'ASSEZ", accent: "#BC0100",
        } as StackedDataState,
        VOTE_TRACKER: {
            title: "VOTE TRACKER", subtitle: "L'ASSEZ MEDIA — REGISTRE DES VOTES",
            subjectName: "SUJET POLITIQUE",
            imageUrl: DC.imageUrl,
            votes: [
                { law: "Loi sur la transparence financière des élus (Amendement 45B)", vote: "CONTRE" },
                { law: "Réforme des retraites : recul de l'âge légal à 65 ans", vote: "CONTRE" },
                { law: "Augmentation des budgets de la défense nationale", vote: "CONTRE" },
                { law: "Protection renforcée des lanceurs d'alerte", vote: "CONTRE" },
                { law: "Réduction des aides sociales pour les plus précaires", vote: "POUR" },
            ],
            variant: "Fiche 1 / 3",
            brand: "L'ASSEZ", accent: "#BC0100",
            colorPour: "#1A1C1C", colorContre: "#BC0100", colorAbst: "#888888",
        } as VoteTrackerState,
        TERRITORY_RADAR: {
            headline: "CARTE DU RAPPORT DE FORCE",
            subheadline: "RÉSULTATS PREMIER TOUR — COMMUNES > 10 000 HABITANTS",
            svgContent: '',
            legend: [
                { color: "#BC0100", label: "GAUCHE / NFP" },
                { color: "#1A1C1C", label: "ABSTENTION" },
                { color: "#555", label: "DROITE / RN" },
                { color: "#888", label: "CENTRE" },
            ],
            stats: [
                { label: "Part. nationale", value: "61.4%" },
                { label: "Abstention", value: "38.6%" },
                { label: "Communes RN", value: "892" },
                { label: "Communes NFP", value: "445" },
            ],
            source: "Source: Ministère de l'Intérieur — Données brutes 2024",
            brand: "L'ASSEZ", accent: "#BC0100",
        } as TerritoryRadarState,
        DECODING: {
            headline: "LE MÉCANICIEN DÉCORTIQUE",
            jargonTerm: "PÉDAGOGIE",
            officialDef: "« Réexpliquer la réforme aux Français qui n'ont pas compris. »",
            realityCheck: "Un gouvernement qui répète le même mensonge plus fort espère que la répétition le rend vrai. La pédagogie du pouvoir n'informe pas — elle soumet.",
            brand: "L'ASSEZ", accent: "#BC0100",
        } as DecodingState,
        CHRONO_LOCK: {
            headline: "LA MÉCANIQUE DE LA TRAHISON",
            subheadline: "RETRACE L'HISTORIQUE — RIEN N'EST UN HASARD",
            timeline: [
                { date: "JANV. 2022", event: "Promesse officielle de ne pas toucher aux retraites", impact: "Déclaration télévisée, 18M téléspectateurs" },
                { date: "MARS 2022", event: "Réélection sur ce programme", impact: "+4pts d'écart grâce à cet engagement" },
                { date: "JAN. 2023", event: "Projet de loi retraites présenté", impact: "Recul âge légal à 64 ans" },
                { date: "MARS 2023", event: "49.3 — Loi adoptée sans vote", impact: "Déni démocratique complet" },
            ],
            brand: "L'ASSEZ", accent: "#BC0100",
        } as ChronoLockState,
        IMPACT_QUOTE: {
            largeQuote: "« Les Français doivent apprendre à se serrer la ceinture. »",
            author: "BRUNO LE MAIRE",
            context: "Ministre de l'Économie — 3 jours après une note de frais de 12 400€",
            brand: "L'ASSEZ", accent: "#BC0100",
        } as ImpactQuoteState,
        SOCIAL_COST: {
            headline: "COMBIEN ÇA VOUS COÛTE VRAIMENT ?",
            targetAudience: "ÉTUDIANTS BOURSIERS",
            monthlyLoss: "-87€",
            annualImpact: "-1 044€",
            consequence: "Suppression partielle des APL + gel des bourses = niveau de vie en-dessous du seuil de pauvreté pour 2,3M d'étudiants.",
            note: "Calcul L'Assez basé sur les données CNAF 2024",
            brand: "L'ASSEZ", accent: "#BC0100",
        } as SocialCostState,
        VIDEO_NOTE: {
            videoUrl: "",
            annotation: "⚠️ Cette vidéo a été supprimée 3 fois. Archivez-la.",
            headline: "DOCUMENT VIDÉO",
            brand: "L'ASSEZ", accent: "#BC0100",
            videoZoom: 1.0,
            videoX: 0,
            videoY: 0,
        } as VideoNoteState,
    };
    const ICONS: Record<SlideType, string> = {
        COVER: '🗞', NEWS: '📰', MANIFESTO: '📜', MAXTEXT: '📝', GRANULAR: '⚡', BIG_NUM: '📊', VERSUS: '⚖️', CHECKLIST: '✅', INFO: '🔥', ANALYSIS: '🔍', OUTRO: '🏁',
        COMPARISON_CHART: '📈', STACKED_DATA: '🟥', VOTE_TRACKER: '🗳',
        TERRITORY_RADAR: '🗺', DECODING: '🔓', CHRONO_LOCK: '⏱', IMPACT_QUOTE: '💬', SOCIAL_COST: '💸', VIDEO_NOTE: '🎬',
    };
    const nid = () => Math.random().toString(36).slice(2, 9);

    // ── LocalStorage persistence ──────────────
    const STORAGE_KEY = 'lassez_studio_deck_v1';
    const loadSaved = (): { deck: Slide[], activeId: string } | null => {
        if (typeof window === 'undefined') return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) return JSON.parse(raw);
        } catch { /* ignore */ }
        return null;
    };

    const [deck, setDeck] = useState<Slide[]>([]);
    const [activeId, setActiveId] = useState<string>('');
    const [isMounted, setIsMounted] = useState(false);

    // FFmpeg.WASM state
    const ffmpegRef = useRef<any>(null);
    const [exportProgress, setExportProgress] = useState<string | null>(null);

    const loadFFmpeg = async () => {
        if (ffmpegRef.current) return ffmpegRef.current;
        const ffmpeg = new FFmpeg();
        setExportProgress("Chargement du moteur vidéo...");
        ffmpeg.on('log', ({ message }) => {
            console.log("FFMPEG LOG:", message);
            // Optional: update UI with the last few log lines if needed
        });

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        ffmpegRef.current = ffmpeg;
        return ffmpeg;
    };

    useEffect(() => {
        const saved = loadSaved();
        if (saved && saved.deck && saved.deck.length > 0) {
            setDeck(saved.deck);
            setActiveId(saved.activeId || saved.deck[0].id);
        } else {
            const defId = nid();
            setDeck([{ id: defId, type: 'NEWS', label: 'Slide 1', state: { ...DN } }]);
            setActiveId(defId);
        }
        setIsMounted(true);
    }, []);

    const [showAddMenu, setShowAddMenu] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [showArticleModal, setShowArticleModal] = useState(false);
    const [articleInput, setArticleInput] = useState('');
    const [showJsonImport, setShowJsonImport] = useState(false);
    // Which slide types the AI is allowed to use (persisted)
    const AI_CONFIG_KEY = 'lassez_ai_types_v1';
    const DEFAULT_AI_TYPES: SlideType[] = ['NEWS', 'MAXTEXT', 'GRANULAR', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST'];
    const [aiEnabledTypes, setAiEnabledTypes] = useState<SlideType[]>(() => {
        if (typeof window === 'undefined') return DEFAULT_AI_TYPES;
        try {
            const saved = localStorage.getItem(AI_CONFIG_KEY);
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return DEFAULT_AI_TYPES;
    });
    const toggleAiType = (t: SlideType) => {
        setAiEnabledTypes(prev => {
            const next = prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t];
            try { localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(next)); } catch { /* ignore */ }
            return next;
        });
    };
    const [jsonInput, setJsonInput] = useState('');

    // Auto-save deck to localStorage on every change
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ deck, activeId })); } catch { /* quota exceeded */ }
        }, 500);
        return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
    }, [deck, activeId]);

    const activeSlide = deck.find(s => s.id === activeId) ?? deck[0] ?? { id: 'dummy', type: 'NEWS', label: 'dummy', state: DN };
    const activeState = activeSlide.state;
    const template = activeSlide.type;

    // Typed state accessors (keep canvas code unchanged) — delegate to deck
    const patchActive = (patch: Partial<AnyState>) =>
        setDeck(d => d.map(s => s.id === activeId ? { ...s, state: { ...s.state, ...patch } } : s));

    // keep per-template helpers pointing to patchActive
    const sc = (p: Partial<CoverState>) => patchActive(p);
    const sn = (p: Partial<NewsState>) => patchActive(p);
    const sm2 = (p: Partial<ManifestoState>) => patchActive(p);
    const smx = (p: Partial<MaxTextState>) => patchActive(p);
    const sgs = (p: Partial<GranularState>) => patchActive(p);
    const sb2 = (p: Partial<BigNumState>) => patchActive(p);
    const sv = (p: Partial<VersusState>) => patchActive(p);
    const sk = (p: Partial<ChecklistState>) => patchActive(p);
    const sis = (p: Partial<InfoState>) => patchActive(p);
    const sda = (p: Partial<AnalysisState>) => patchActive(p);
    const sdo = (p: Partial<OutroState>) => patchActive(p);
    const scc = (p: Partial<ComparisonChartState>) => patchActive(p);
    const ssd = (p: Partial<StackedDataState>) => patchActive(p);
    const svt = (p: Partial<VoteTrackerState>) => patchActive(p);

    // Typed state views (canvas uses these)
    const cover = (template === 'COVER' ? activeState : DC) as CoverState;
    const news = (template === 'NEWS' ? activeState : DN) as NewsState;
    const manifesto = (template === 'MANIFESTO' ? activeState : DM) as ManifestoState;
    const maxtext = (template === 'MAXTEXT' ? activeState : DMX) as MaxTextState;
    const granular = (template === 'GRANULAR' ? activeState : DGS) as GranularState;
    const bignum = (template === 'BIG_NUM' ? activeState : DEFAULTS.BIG_NUM) as BigNumState;
    const versus = (template === 'VERSUS' ? activeState : DEFAULTS.VERSUS) as VersusState;
    const checklist = (template === 'CHECKLIST' ? activeState : DEFAULTS.CHECKLIST) as ChecklistState;
    const info = (template === 'INFO' ? activeState : DIS) as InfoState;
    const analysis = (template === 'ANALYSIS' ? activeState : DAN) as AnalysisState;
    const outro = (template === 'OUTRO' ? activeState : DOU) as OutroState;
    const chart = (template === 'COMPARISON_CHART' ? activeState : DEFAULTS.COMPARISON_CHART) as ComparisonChartState;
    const stackedData = (template === 'STACKED_DATA' ? activeState : DEFAULTS.STACKED_DATA) as StackedDataState;
    const voteTracker = (template === 'VOTE_TRACKER' ? activeState : DEFAULTS.VOTE_TRACKER) as VoteTrackerState;
    const territoryRadar = (template === 'TERRITORY_RADAR' ? activeState : DEFAULTS.TERRITORY_RADAR) as TerritoryRadarState;
    const decoding = (template === 'DECODING' ? activeState : DEFAULTS.DECODING) as DecodingState;
    const chronoLock = (template === 'CHRONO_LOCK' ? activeState : DEFAULTS.CHRONO_LOCK) as ChronoLockState;
    const impactQuote = (template === 'IMPACT_QUOTE' ? activeState : DEFAULTS.IMPACT_QUOTE) as ImpactQuoteState;
    const socialCost = (template === 'SOCIAL_COST' ? activeState : DEFAULTS.SOCIAL_COST) as SocialCostState;
    const videoNote = (template === 'VIDEO_NOTE' ? activeState : DEFAULTS.VIDEO_NOTE) as VideoNoteState;
    const str = (p: Partial<TerritoryRadarState>) => patchActive(p);
    const sdec = (p: Partial<DecodingState>) => patchActive(p);
    const scl = (p: Partial<ChronoLockState>) => patchActive(p);
    const siq = (p: Partial<ImpactQuoteState>) => patchActive(p);
    const ssc = (p: Partial<SocialCostState>) => patchActive(p);
    const svn = (p: Partial<VideoNoteState>) => patchActive(p);

    const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const url = URL.createObjectURL(file);
            svn({ videoUrl: url });
        }
    };

    // Deck operations
    const addSlide = (type: SlideType) => {
        const idx = deck.length + 1;
        const newSlide: Slide = { id: nid(), type, label: `Slide ${idx}`, state: { ...DEFAULTS[type] } };
        setDeck(d => [...d, newSlide]);
        setActiveId(newSlide.id);
        setShowAddMenu(false);
    };
    const duplicateSlide = (id: string) => {
        const src = deck.find(s => s.id === id); if (!src) return;
        const dup: Slide = { ...src, id: nid(), label: src.label + ' (copie)', state: { ...src.state } };
        setDeck(d => { const i = d.findIndex(s => s.id === id); const r = [...d]; r.splice(i + 1, 0, dup); return r; });
        setActiveId(dup.id);
    };
    const deleteSlide = (id: string) => {
        if (deck.length === 1) { alert('Il faut au moins une slide !'); return; }
        if (!confirm('Supprimer cette slide ?')) return;
        setDeck(d => { const n = d.filter(s => s.id !== id); if (id === activeId) setActiveId(n[0].id); return n; });
    };
    const moveSlide = (id: string, dir: -1 | 1) => {
        setDeck(d => {
            const i = d.findIndex(s => s.id === id); if (i < 0) return d;
            const j = i + dir; if (j < 0 || j >= d.length) return d;
            const r = [...d];[r[i], r[j]] = [r[j], r[i]]; return r;
        });
    };
    const renameSlide = (id: string, label: string) =>
        setDeck(d => d.map(s => s.id === id ? { ...s, label } : s));


    const exportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!postId) { setLoading(false); return; }
        fetch('/api/radar?status=PENDING').then(r => r.json()).then(data => {
            if (data.success) {
                const found = data.posts?.find((p: any) => p.id === parseInt(postId));
                if (found) {
                    const title = found.source_title || '';
                    const body = found.banger || '';
                    setArticleInput(`${title}\n\n${body}`);
                    // Pre-fill the default slide with title
                    setDeck(d => d.map((s, i) => i === 0 ? { ...s, state: { ...s.state, headline: title } } : s));
                }
            }
        }).catch(() => { }).finally(() => setLoading(false));
    }, [postId]);

    // strip styles on active slide
    const stripStyles = () => {
        const strip = (h: string) => {
            const d = document.createElement('div'); d.innerHTML = h;
            d.querySelectorAll<HTMLElement>('span,b,i,u,strong,em').forEach(el => {
                if (el.style?.backgroundColor) {
                    const bg = el.style.backgroundColor; el.removeAttribute('style'); el.style.backgroundColor = bg;
                } else { el.replaceWith(document.createTextNode(el.textContent || '')); }
            }); return d.innerHTML;
        };
        const s = activeState as any;
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
        setDeck(d => d.map(s => s.id === activeId ? { ...s, state: { ...DEFAULTS[s.type] } } : s));
    };

    // AI: Style the active slide text
    const aiStyle = async () => {
        setAiLoading(true);
        const s = activeState as any;
        const textFields: Record<string, string> = {};
        (['headline', 'leadParagraph', 'bodyLeft', 'bodyRight', 'body', 'bodyMono', 'bodyParagraph', 'quote'].forEach((k: string) => { if (s[k]) textFields[k] = s[k]; }));
        try {
            const res = await fetch('/api/radar/studio-ai/style', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: textFields, bg: 'light', accent: (s.accent || '#DC2626') }),
            });
            const data = await res.json();
            if (data.styledFields) patchActive(data.styledFields);
        } catch (e) { console.error(e); alert('Erreur IA styling'); }
        setAiLoading(false);
    };

    // AI: Generate full deck from article text
    const aiGenerateDeck = async () => {
        if (!articleInput.trim()) return;
        setAiLoading(true);
        try {
            const res = await fetch('/api/radar/studio-ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ article: articleInput, enabledTypes: aiEnabledTypes }),
            });
            const data = await res.json();

            if (data.error) {
                alert(`Erreur IA:\n${data.error}\n\n${data.raw || ''}`);
                setAiLoading(false);
                return;
            }

            if (data.deck && Array.isArray(data.deck) && data.deck.length > 0) {
                const ALL_VALID_TYPES: SlideType[] = ['COVER', 'NEWS', 'MANIFESTO', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'VERSUS', 'CHECKLIST', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'];
                const validSlides = data.deck.filter((s: any) => ALL_VALID_TYPES.includes(s.type));

                if (validSlides.length === 0) {
                    alert(`L'IA a renvoyé des types invalides: ${data.deck.map((s: any) => s.type).join(', ')}`);
                    setAiLoading(false);
                    return;
                }

                // Convert TAG_IMAGE keywords to real image URLs
                const resolveImageUrl = (url: string | undefined, defaultUrl: string) => {
                    if (!url) return defaultUrl;
                    // If it's already a proper URL, keep it
                    if (url.startsWith('http://') || url.startsWith('https://')) return url;
                    // Keyword fallback: use picsum (source.unsplash.com is deprecated)
                    return `https://picsum.photos/seed/${encodeURIComponent(url.trim())}/1200/800`;
                };

                const newDeck: Slide[] = validSlides.map((s: any, i: number) => {
                    const defaultImg = (DEFAULTS[s.type as SlideType] as any).imageUrl || DC.imageUrl;
                    const state = { ...(DEFAULTS[s.type as SlideType] || DN), ...s.state };
                    if ('imageUrl' in state) {
                        (state as any).imageUrl = resolveImageUrl((state as any).imageUrl, defaultImg);
                    }
                    return { id: nid(), type: s.type as SlideType, label: `Slide ${i + 1} — ${s.type}`, state };
                });
                setDeck(newDeck);
                setActiveId(newDeck[0].id);
                setShowArticleModal(false);
            } else {
                alert(`Réponse inattendue de l'IA:\n${JSON.stringify(data).slice(0, 300)}`);
            }
        } catch (e: any) {
            console.error(e);
            alert(`Erreur réseau:\n${e.message}`);
        }
        setAiLoading(false);
    };

    // ── JSON Import / Export ─────────────────
    const handleExportJSON = () => {
        const cleanDeck = deck.map(s => ({ type: s.type, state: s.state }));
        const jsonStr = JSON.stringify({ deck: cleanDeck }, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const a = document.createElement('a');
        a.download = `lassez-deck-${Date.now()}.json`;
        a.href = URL.createObjectURL(blob);
        a.click();
        try { navigator.clipboard.writeText(jsonStr); } catch { /* ignore */ }
    };

    const importJSONDeck = () => {
        if (!jsonInput.trim()) return;
        try {
            const data = JSON.parse(jsonInput);
            if (!data.deck || !Array.isArray(data.deck) || data.deck.length === 0) {
                alert("Erreur: Le JSON doit contenir un objet avec une clé 'deck' contenant un tableau de slides.");
                return;
            }
            const ALL_VALID_TYPES: SlideType[] = ['COVER', 'NEWS', 'MANIFESTO', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'VERSUS', 'CHECKLIST', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'];
            const validSlides = data.deck.filter((s: any) => ALL_VALID_TYPES.includes(s.type));

            if (validSlides.length === 0) {
                alert(`Aucune slide valide trouvée. Types détectés: ${data.deck.map((s: any) => s.type).join(', ')}`);
                return;
            }

            const resolveImageUrl = (url: string | undefined, defaultUrl: string) => {
                if (!url) return defaultUrl;
                if (url.startsWith('http://') || url.startsWith('https://')) return url;
                return `https://picsum.photos/seed/${encodeURIComponent(url.trim())}/1200/800`;
            };

            const newDeck: Slide[] = validSlides.map((s: any, i: number) => {
                const defaultImg = (DEFAULTS[s.type as SlideType] as any).imageUrl || DC.imageUrl;
                const state = { ...(DEFAULTS[s.type as SlideType] || DN), ...s.state };
                if ('imageUrl' in state) {
                    (state as any).imageUrl = resolveImageUrl((state as any).imageUrl, defaultImg);
                }
                return { id: nid(), type: s.type as SlideType, label: `Slide ${i + 1} — ${s.type}`, state };
            });

            setDeck(newDeck);
            setActiveId(newDeck[0].id);
            setShowJsonImport(false);
            setJsonInput('');
        } catch (e: any) {
            alert(`Erreur de syntaxe JSON:\n${e.message}`);
        }
    };


    // Export current active slide
    // Convert all external images to base64 data URLs (only truly CORS-safe method for toPng)
    // IMPORTANT: must set BOTH img.src (DOM prop) AND setAttribute (HTML attr) because
    // toPng clones nodes with cloneNode(true) which copies attributes, not DOM properties.
    const embedImages = async (node: HTMLElement) => {
        const imgs = Array.from(node.querySelectorAll<HTMLImageElement>('img'));
        await Promise.all(imgs.map(async img => {
            const src = img.getAttribute('src') || img.src;
            // Skip already-embedded or local images
            if (!src || src.startsWith('data:') || src.startsWith('/') || src.startsWith('blob:')) return;
            try {
                const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(src)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) return;
                const blob = await res.blob();
                // Convert blob → base64 data URL
                const dataUrl = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
                // Set BOTH: property (live DOM) AND attribute (copied by cloneNode)
                img.setAttribute('src', dataUrl);
                img.src = dataUrl;
                // Wait for browser to acknowledge
                await new Promise<void>(r => {
                    if (img.complete && img.naturalWidth > 0) { r(); return; }
                    img.onload = () => r();
                    img.onerror = () => r();
                    setTimeout(r, 4000);
                });
            } catch { /* keep original src if anything fails */ }
        }));
    };

    const handleExport = async () => {
        if (!exportRef.current) return;

        if (template === 'VIDEO_NOTE') {
            const vn = videoNote;
            const isYt = vn.videoUrl.includes('youtube') || vn.videoUrl.includes('youtu.be');
            const liveZone = exportRef.current.querySelector<HTMLElement>('[data-export="live"]');
            const videoEl = liveZone?.querySelector('video') as HTMLVideoElement | null;

            if (!isYt && vn.videoUrl && liveZone) {
                // ════════════════════════════════════════════════════════════════
                // MODE MP4 — Composite via FFmpeg.WASM (CLIENT-SIDE)
                // ════════════════════════════════════════════════════════════════
                setExportProgress("Initialisation...");
                if (typeof SharedArrayBuffer === 'undefined') {
                    console.warn("SharedArrayBuffer is UNDEFINED. Check COOP/COEP headers in next.config.mjs.");
                }

                // 1) Mesurer la zone vidéo
                const exportRect = exportRef.current.getBoundingClientRect();
                const liveRect = liveZone.getBoundingClientRect();
                const scaleX = 1080 / exportRect.width;
                const scaleY = 1350 / exportRect.height;
                const vx = Math.round((liveRect.left - exportRect.left) * scaleX);
                const vy = Math.round((liveRect.top - exportRect.top) * scaleY);
                const vw = Math.round(liveRect.width * scaleX);
                const vh = Math.round(liveRect.height * scaleY);

                // Fallbacks for older slides
                const vz = vn.videoZoom || 1;
                const vpx = vn.videoX || 0;
                const vpy = vn.videoY || 0;

                // 2) Capturer l'overlay HTML (sans la vidéo)
                let overlayBase64: string;
                try {
                    const uiOverlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
                    uiOverlays.forEach(el => el.style.display = 'none');
                    const liveNode = exportRef.current.querySelector<HTMLElement>('[data-export="live"]');
                    if (liveNode) {
                        liveNode.style.visibility = 'hidden';
                    }
                    const prevBgClass = exportRef.current.classList.contains('bg-black');
                    if (prevBgClass) exportRef.current.classList.remove('bg-black');
                    exportRef.current.style.backgroundColor = 'rgba(0,0,0,0)';

                    overlayBase64 = await toPng(exportRef.current, {
                        quality: 1,
                        pixelRatio: 2,
                        canvasWidth: 1080,
                        canvasHeight: 1350,
                        backgroundColor: 'rgba(0,0,0,0)',
                        style: { margin: '0' },
                        filter: (node: Node) => {
                            if (node instanceof HTMLElement && (node.tagName === 'VIDEO' || node.tagName === 'IFRAME')) return false;
                            return true;
                        },
                    });

                    if (liveNode) {
                        liveNode.style.visibility = 'visible';
                    }
                    if (prevBgClass) exportRef.current.classList.add('bg-black');
                    exportRef.current.style.backgroundColor = '';

                    console.log("Overlay captured successfully, length:", overlayBase64.length);
                    uiOverlays.forEach(el => el.style.display = '');
                } catch (e) {
                    setExportProgress(null);
                    alert("Erreur capture template.");
                    return;
                }

                try {
                    // 3) Initialiser FFmpeg
                    const ffmpeg = await loadFFmpeg();

                    // 4) Charger la vidéo (Proxy pour remote, direct pour local blob)
                    let videoBlob: Blob;
                    if (vn.videoUrl.startsWith('blob:')) {
                        setExportProgress("Préparation de la vidéo locale...");
                        const res = await fetch(vn.videoUrl);
                        videoBlob = await res.blob();
                    } else {
                        setExportProgress("Téléchargement de la vidéo...");
                        const videoRes = await fetch(`/api/proxy-image?url=${encodeURIComponent(vn.videoUrl)}`);
                        if (!videoRes.ok) throw new Error("Erreur proxy vidéo");
                        videoBlob = await videoRes.blob();
                    }

                    // 5) Écrire les fichiers dans le FS virtuel
                    const vFile = await fetchFile(videoBlob);
                    const oFile = await fetchFile(overlayBase64);
                    console.log("Input sizes - Video:", (vFile as any).length, "Overlay:", (oFile as any).length);
                    
                    if ((vFile as any).length === 0) throw new Error("La vidéo source est vide ou n'a pas pu être chargée.");
                    if ((oFile as any).length === 0) throw new Error("L'overlay image est vide.");

                    await ffmpeg.writeFile('input.mp4', vFile);
                    await ffmpeg.writeFile('overlay.png', oFile);

                    // 6) Composite ffmpeg
                    setExportProgress("Montage vidéo...");
                    ffmpeg.on('progress', ({ progress }: any) => {
                        setExportProgress(`Montage: ${Math.round(progress * 100)}%`);
                    });

                    const filterComplex = [
                        // Scale to COVER the target zone first
                        `[0:v]scale='if(gt(a,${vw}/${vh}),-1,${vw})':'if(gt(a,${vw}/${vh}),${vh},-1)'[scaled]`,
                        // Apply user zoom
                        `[scaled]scale=iw*${vz}:ih*${vz}[zoomed]`,
                        // Crop based on offset (negated because we move the video opposite to the drag)
                        `[zoomed]crop=${vw}:${vh}:(iw-${vw})/2-${vpx * scaleX}:(ih-${vh})/2-${vpy * scaleY}[v]`,
                        // Create black background
                        `color=black:s=1080x1350:r=30:d=999[bg]`,
                        // Scale overlay image
                        `[1:v]scale=1080:1350:force_original_aspect_ratio=disable[ov]`,
                        // Lay video onto black background
                        `[bg][v]overlay=${vx}:${vy}:shortest=1[base]`,
                        // Lay the graphic PNG ON TOP
                        `[base][ov]overlay=0:0:shortest=0:format=auto,format=yuv420p[out]`,
                    ].join(';');

                    await ffmpeg.exec([
                        '-i', 'input.mp4',
                        '-loop', '1', '-framerate', '30', '-i', 'overlay.png',
                        '-filter_complex', filterComplex,
                        '-map', '[out]',
                        '-map', '0:a?',
                        '-c:v', 'libx264',
                        '-preset', 'ultrafast',
                        '-crf', '28',
                        '-c:a', 'aac',
                        '-shortest',
                        'output.mp4',
                    ]);
                    setExportProgress("Finalisation...");

                    // 7) Vérifier et télécharger le résultat
                    const data = await ffmpeg.readFile('output.mp4');
                    if (!data || (data as any).length === 0) {
                        throw new Error("L'encodage a réussi mais le fichier de sortie est vide (0 octets). Cela arrive parfois si les codecs de la vidéo source ne sont pas supportés par l'encodeur du navigateur.");
                    }

                    const blob = new Blob([data as any], { type: 'video/mp4' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `lassez-${activeSlide.label.replace(/\s+/g, '-').toLowerCase()}.mp4`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 5000);
                    setExportProgress(null);
                } catch (e: any) {
                    console.error("FFmpeg Export Error:", e);
                    setExportProgress(null);
                    const msg = e instanceof Error ? e.message : (typeof e === 'string' ? e : JSON.stringify(e));
                    alert(`Erreur export: ${msg}`);
                }
                return;
            }

            // ════════════════════════════════════════════════════
            // MODE YOUTUBE (ou pas d'URL) : export PNG statique
            // ════════════════════════════════════════════════════
            const staticZone = exportRef.current.querySelector<HTMLElement>('[data-export="static"]');
            const prevLive = liveZone?.style.display ?? '';
            const prevStatic = staticZone?.style.display ?? '';
            if (liveZone) liveZone.style.display = 'none';
            if (staticZone) staticZone.style.display = 'flex';
            await new Promise(r => setTimeout(r, 80));
            try {
                const overlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
                overlays.forEach(el => el.style.display = 'none');
                const dataUrl = await toPng(exportRef.current, { quality: 1, pixelRatio: 2, canvasWidth: 1080, canvasHeight: 1350, style: { margin: '0' } });
                overlays.forEach(el => el.style.display = '');
                const a = document.createElement('a');
                a.download = `lassez-${activeSlide.label.replace(/\s+/g, '-').toLowerCase()}.png`;
                a.href = dataUrl; a.click();
            } catch (e) { console.error(e); alert('Erreur export PNG. Vérifie la console.'); }
            if (liveZone) liveZone.style.display = prevLive;
            if (staticZone) staticZone.style.display = prevStatic;
            return;
        }

        try {
            await embedImages(exportRef.current);
            const overlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
            overlays.forEach(el => el.style.display = 'none');
            const dataUrl = await toPng(exportRef.current, { quality: 1, pixelRatio: 2, canvasWidth: 1080, canvasHeight: 1350, style: { margin: '0' } });
            overlays.forEach(el => el.style.display = '');
            const a = document.createElement('a');
            a.download = `lassez-${activeSlide.label.replace(/\s+/g, '-').toLowerCase()}.png`;
            a.href = dataUrl; a.click();
        } catch (e) { console.error(e); alert("Erreur export. Vérifie la console."); }
    };

    // Export all slides as ZIP
    const handleExportAll = async () => {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        for (let i = 0; i < deck.length; i++) {
            setActiveId(deck[i].id);
            await new Promise(r => setTimeout(r, 400)); // wait for re-render
            if (!exportRef.current) continue;
            await embedImages(exportRef.current);
            const overlays = exportRef.current.querySelectorAll<HTMLElement>('.edit-overlay,.edit-sticker,.brut-tb');
            overlays.forEach(el => el.style.display = 'none');
            const dataUrl = await toPng(exportRef.current, { quality: 1, pixelRatio: 2, canvasWidth: 1080, canvasHeight: 1350, style: { margin: '0' } });
            overlays.forEach(el => el.style.display = '');
            const b64 = dataUrl.split(',')[1];
            zip.file(`slide-${String(i + 1).padStart(2, '0')}-${deck[i].type.toLowerCase()}.png`, b64, { base64: true });
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        const a = document.createElement('a'); a.download = `lassez-deck-${Date.now()}.zip`;
        a.href = URL.createObjectURL(blob); a.click();
    };


    if (!isMounted || loading) return <div className="h-screen bg-black sg text-white flex items-center justify-center"><span className="sm text-[10px] uppercase tracking-widest opacity-40">Loading Studio UI…</span></div>;

    const curAccent = (activeState as any).accent || '#DC2626';
    const acVar = { '--ac': curAccent } as React.CSSProperties;

    return (
        <div className="bg-zinc-900 text-white h-screen overflow-hidden flex flex-col sg" style={acVar}>
            <style dangerouslySetInnerHTML={{ __html: CSS }} />

            {/* ARTICLE INPUT MODAL */}
            {showArticleModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8">
                    <div className="bg-[#0d0d0d] border border-white/10 w-full max-w-2xl flex flex-col gap-4 p-6" style={{ boxShadow: `8px 8px 0 ${curAccent}` }}>
                        <div className="flex justify-between items-center">
                            <span className="sm text-[10px] uppercase font-bold" style={{ color: curAccent }}>✨ Générer le deck depuis un article</span>
                            <button onClick={() => setShowArticleModal(false)} className="sm text-[10px] text-gray-500 hover:text-white">✕ Fermer</button>
                        </div>
                        <p className="sm text-[9px] text-gray-500 uppercase">Colle ton article, ton flash info ou ton brief. L'IA va créer un deck de slides Instagram complet, avec le stylisme adapté.</p>
                        <textarea
                            className="si w-full h-36 resize-none"
                            placeholder="Colle ton article ici…"
                            value={articleInput}
                            onChange={e => setArticleInput(e.target.value)}
                        />

                        {/* ── AI Template Selector ─────────────────────────── */}
                        <div className="border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <div className="flex justify-between items-center">
                                <p className="sm text-[9px] uppercase tracking-widest font-bold" style={{ color: curAccent }}>⚙ Paramètres IA — Templates autorisés</p>
                                <div className="flex gap-3">
                                    <button onClick={() => {
                                        const all = ['COVER','NEWS','MAXTEXT','GRANULAR','BIG_NUM','INFO','ANALYSIS','OUTRO','COMPARISON_CHART','STACKED_DATA','VOTE_TRACKER','TERRITORY_RADAR','DECODING','CHRONO_LOCK','IMPACT_QUOTE','SOCIAL_COST','VIDEO_NOTE'] as SlideType[];
                                        setAiEnabledTypes(all);
                                        try { localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(all)); } catch { /* ignore */ }
                                    }} className="sm text-[8px] text-gray-500 hover:text-white uppercase">Tout cocher</button>
                                    <button onClick={() => {
                                        setAiEnabledTypes([]);
                                        try { localStorage.setItem(AI_CONFIG_KEY, JSON.stringify([])); } catch { /* ignore */ }
                                    }} className="sm text-[8px] text-gray-500 hover:text-white uppercase">Tout décocher</button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {([
                                    // ── Éditorial classique
                                    { type: 'NEWS' as SlideType, desc: "Flash Info #1" },
                                    { type: 'COVER' as SlideType, desc: "Accroche visuelle" },
                                    { type: 'MAXTEXT' as SlideType, desc: "Analyse longue" },
                                    { type: 'GRANULAR' as SlideType, desc: "Corps + Citation" },
                                    { type: 'BIG_NUM' as SlideType, desc: "Chiffre choc" },
                                    { type: 'INFO' as SlideType, desc: "Alerte/Warning" },
                                    { type: 'ANALYSIS' as SlideType, desc: "3 faits clés" },
                                    { type: 'OUTRO' as SlideType, desc: "CTA Final" },
                                    // ── Infographies data
                                    { type: 'COMPARISON_CHART' as SlideType, desc: "Graphique barres" },
                                    { type: 'STACKED_DATA' as SlideType, desc: "Matrice données" },
                                    { type: 'VOTE_TRACKER' as SlideType, desc: "Registre votes" },
                                    { type: 'TERRITORY_RADAR' as SlideType, desc: "Carte électorale" },
                                    // ── Impact éditorial
                                    { type: 'DECODING' as SlideType, desc: "Novlangue décodée" },
                                    { type: 'CHRONO_LOCK' as SlideType, desc: "Ligne de temps" },
                                    { type: 'IMPACT_QUOTE' as SlideType, desc: "Citation gros calibre" },
                                    { type: 'SOCIAL_COST' as SlideType, desc: "Calculette précarité" },
                                    { type: 'VIDEO_NOTE' as SlideType, desc: "Document vidéo" },
                                ]).map(({ type, desc }) => {
                                    const isEnabled = aiEnabledTypes.includes(type);
                                    return (
                                        <label key={type} onClick={() => toggleAiType(type)}
                                            className="flex items-start gap-2 p-2 cursor-pointer border transition-colors"
                                            style={{
                                                borderColor: isEnabled ? curAccent : 'rgba(255,255,255,0.08)',
                                                background: isEnabled ? `${curAccent}15` : 'transparent'
                                            }}>
                                            <div className="w-4 h-4 border-2 shrink-0 mt-0.5 flex items-center justify-center"
                                                style={{ borderColor: isEnabled ? curAccent : '#555', background: isEnabled ? curAccent : 'transparent' }}>
                                                {isEnabled && <span className="text-white text-[10px] font-bold">✓</span>}
                                            </div>
                                            <div>
                                                <p className="sm text-[9px] font-bold uppercase" style={{ color: isEnabled ? '#fff' : '#666' }}>{ICONS[type]} {type}</p>
                                                <p className="sm text-[8px] text-gray-600 uppercase">{desc}</p>
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                            {aiEnabledTypes.length === 0 && (
                                <p className="sm text-[8px] text-red-500 uppercase">⚠ Coche au moins un type pour que l'IA puisse générer un deck.</p>
                            )}
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowArticleModal(false)} className="sm text-[9px] px-4 py-2 border border-white/10 uppercase">Annuler</button>
                            <button onClick={aiGenerateDeck} disabled={aiLoading || !articleInput.trim() || aiEnabledTypes.length === 0}
                                className="sm text-[9px] px-5 py-2 font-bold uppercase text-black disabled:opacity-40"
                                style={{ background: curAccent }}>
                                {aiLoading ? '⏳ Génération…' : `✨ Générer (${aiEnabledTypes.length} types)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* JSON IMPORT MODAL */}
            {showJsonImport && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8">
                    <div className="bg-[#0d0d0d] border border-white/10 w-full max-w-2xl flex flex-col gap-4 p-6" style={{ boxShadow: `8px 8px 0 ${curAccent}` }}>
                        <div className="flex justify-between items-center">
                            <span className="sm text-[10px] uppercase font-bold text-white">📥 Importer un Deck (JSON)</span>
                            <button onClick={() => setShowJsonImport(false)} className="sm text-[10px] text-gray-500 hover:text-white">✕ Fermer</button>
                        </div>
                        <p className="sm text-[9px] text-gray-400 uppercase leading-relaxed">Colle un JSON compatible (ex: généré par l'IA externe ou exporté). Le deck actuel sera écrasé.<br />Format attendu: <code className="bg-white/10 px-1 py-0.5 ml-1 select-all">{`{"deck": [{"type": "NEWS", "state": {...}}]}`}</code></p>
                        <textarea
                            className="si w-full h-64 resize-none sm text-[10px] leading-relaxed"
                            placeholder="Colle le JSON ici…"
                            value={jsonInput}
                            onChange={e => setJsonInput(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowJsonImport(false)} className="sm text-[9px] px-4 py-2 border border-white/10 uppercase">Annuler</button>
                            <button onClick={importJSONDeck} disabled={!jsonInput.trim()}
                                className="sm text-[9px] px-5 py-2 font-bold uppercase disabled:opacity-40 transition-colors"
                                style={{ background: '#fff', color: '#000' }}>
                                Importer le JSON
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <div className="h-12 bg-black border-b-2 flex items-center justify-between px-5 shrink-0 z-50" style={{ borderColor: curAccent }}>
                <div className="flex items-center gap-4">
                    <div className="px-2 py-1 sm font-bold text-[10px] uppercase text-black" style={{ background: curAccent }}>✎ DECK STUDIO</div>
                    <span className="sm text-[9px] opacity-35 hidden md:block uppercase">{deck.length} slide{deck.length > 1 ? 's' : ''}</span>
                    <button onClick={() => router.push('/radar-admin')} className="sm text-[9px] uppercase text-gray-500 hover:text-white transition-colors">← Admin</button>
                </div>
                <div className="flex gap-2 items-center">
                    <button onClick={() => setShowArticleModal(true)}
                        className="sm text-[9px] px-3 py-1.5 border uppercase transition-colors" style={{ borderColor: `${curAccent}60`, color: curAccent }}>
                        ✨ IA Article → Deck
                    </button>
                    <button onClick={stripStyles} className="sm text-[9px] px-3 py-1.5 border border-white/10 hover:border-white/30 uppercase transition-colors" title="Reset styles (garde surlignages)">↺ Styles</button>
                    <button onClick={fullReset} className="sm text-[9px] px-3 py-1.5 border border-red-900/40 text-red-500 hover:bg-red-900/20 uppercase transition-colors">✕ Reset</button>
                    <span className="w-px h-4 bg-white/10 mx-1"></span>
                    <button onClick={() => setShowJsonImport(true)} className="sm text-[9px] px-3 py-1.5 border border-white/20 uppercase hover:border-white/50 transition-colors">↑ Importer JSON</button>
                    <button onClick={handleExportJSON} className="sm text-[9px] px-3 py-1.5 border border-white/20 uppercase hover:border-white/50 transition-colors">↓ Exporter JSON</button>
                    <span className="w-px h-4 bg-white/10 mx-1"></span>
                    <button onClick={handleExportAll} className="sm text-[9px] px-3 py-1.5 border border-white/20 uppercase hover:border-white/50 transition-colors">⇓ ZIP Tout</button>
                    <button onClick={handleExport} className="sm text-[9px] font-bold px-4 py-1.5 text-black uppercase transition-colors" style={{ background: '#fff', boxShadow: `3px 3px 0 ${curAccent}` }}
                        onMouseEnter={e => { e.currentTarget.style.background = curAccent; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#000'; }}>
                        ↓ Export PNG
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">

                {/* SIDEBAR — Slide list + Controls */}
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
                                        {/* ⚠ MANIFESTO, VERSUS, CHECKLIST désactivés — gardés dans le code */}
                                        {(['COVER', 'NEWS', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'] as SlideType[]).map(t => (
                                            <button key={t} onClick={() => addSlide(t)}
                                                className="w-full text-left sm text-[9px] px-3 py-2 uppercase hover:bg-white/5 flex items-center gap-2">
                                                <span>{ICONS[t]}</span>{t.replace(/_/g, ' ')}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto sb">
                            {deck.map((slide, idx) => (
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

                    {/* ── AI Style button ─────────────── */}
                    <div className="px-3 py-2 border-b border-white/10 shrink-0">
                        <button onClick={aiStyle} disabled={aiLoading}
                            className="w-full sm text-[9px] py-1.5 font-bold uppercase transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                            style={{ background: `${curAccent}20`, border: `1px solid ${curAccent}50`, color: curAccent }}>
                            {aiLoading ? '⏳ Style IA…' : '✨ Style IA — mettre en avant'}
                        </button>
                    </div>

                    {/* ── Controls for active slide ─────── */}
                    <div className="flex-1 overflow-y-auto sb p-4 space-y-5">

                        {/* COVER SIDEBAR */}
                        {template === 'COVER' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={cover.brand} onChange={e => sc({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={cover.accent} onChange={e => sc({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={cover.accent} onChange={e => sc({ accent: e.target.value })} /></div></F>
                                <F label="Fond canvas"><div className="flex gap-2"><input type="color" value={cover.bg} onChange={e => sc({ bg: e.target.value })} className="w-8 h-7 shrink-0" /><input className="si flex-1" value={cover.bg} onChange={e => sc({ bg: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Image</p>
                                <F label="URL image"><input className="si" value={cover.imageUrl} onChange={e => sc({ imageUrl: e.target.value })} /></F>
                                <F label={`Zoom: ${cover.zoom.toFixed(2)}x`}><input type="range" min="1" max="3" step="0.05" value={cover.zoom} onChange={e => sc({ zoom: +e.target.value })} /></F>
                                <F label={`Filtre N&B: ${cover.grayscale}%`}><input type="range" min="0" max="100" step="1" value={cover.grayscale} onChange={e => sc({ grayscale: +e.target.value })} /></F>
                                <p className="sm text-[9px] text-gray-600 uppercase">↕ Glisser l'image dans le canvas pour la repositionner</p>
                                <button onClick={() => sc({ posX: 0, posY: 0 })} className="sm text-[9px] w-full py-1.5 border border-white/10 uppercase hover:border-white/30 transition-colors">↺ Centrer image</button>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Cover</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <F label="Issue #"><input className="si" value={cover.issueNum} onChange={e => sc({ issueNum: e.target.value })} /></F>
                                    <F label="Lecture"><input className="si" value={cover.readTime} onChange={e => sc({ readTime: e.target.value })} /></F>
                                </div>
                                <F label="Auteur"><input className="si" value={cover.author} onChange={e => sc({ author: e.target.value })} /></F>
                                <F label="Label swipe"><input className="si" value={cover.swipeLabel} onChange={e => sc({ swipeLabel: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* NEWS SIDEBAR */}
                        {template === 'NEWS' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={news.brand} onChange={e => sn({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={news.accent} onChange={e => sn({ accent: e.target.value })} className="w-8 h-7 shrink-0" /><input className="si flex-1" value={news.accent} onChange={e => sn({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Image</p>
                                <F label="URL image"><input className="si" value={news.imageUrl} onChange={e => sn({ imageUrl: e.target.value })} /></F>
                                <F label={`Zoom: ${news.zoom.toFixed(2)}x`}><input type="range" min="1" max="3" step="0.05" value={news.zoom} onChange={e => sn({ zoom: +e.target.value })} /></F>
                                <F label={`Filtre N&B: ${news.grayscale}%`}><input type="range" min="0" max="100" step="1" value={news.grayscale} onChange={e => sn({ grayscale: +e.target.value })} /></F>
                                <button onClick={() => sn({ posX: 0, posY: 0 })} className="sm text-[9px] w-full py-1.5 border border-white/10 uppercase hover:border-white/30 transition-colors">↺ Centrer image</button>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>News</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <F label="Catégorie"><input className="si" value={news.category} onChange={e => sn({ category: e.target.value })} /></F>
                                    <F label="Date"><input className="si" value={news.date} onChange={e => sn({ date: e.target.value })} /></F>
                                </div>
                                <F label="Sujet"><input className="si" value={news.topic} onChange={e => sn({ topic: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* MANIFESTO SIDEBAR */}
                        {template === 'MANIFESTO' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={manifesto.brand} onChange={e => sm2({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={manifesto.accent} onChange={e => sm2({ accent: e.target.value })} className="w-8 h-7 shrink-0" /><input className="si flex-1" value={manifesto.accent} onChange={e => sm2({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Manifesto</p>
                                <F label="Réf. doc"><input className="si" value={manifesto.docNum} onChange={e => sm2({ docNum: e.target.value })} /></F>
                                <F label={`Taille titre: ${manifesto.titleSize}px`}><input type="range" min="20" max="72" value={manifesto.titleSize} onChange={e => sm2({ titleSize: +e.target.value })} /></F>
                                <F label="Status bas-gauche"><input className="si" value={manifesto.metaLeft} onChange={e => sm2({ metaLeft: e.target.value })} /></F>
                                <F label="Label action"><input className="si" value={manifesto.actionLabel} onChange={e => sm2({ actionLabel: e.target.value })} /></F>
                                <F label="Texte bas-droit"><input className="si" value={manifesto.metaRight} onChange={e => sm2({ metaRight: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* MAXTEXT SIDEBAR */}
                        {template === 'MAXTEXT' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={maxtext.brand} onChange={e => smx({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={maxtext.accent} onChange={e => smx({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={maxtext.accent} onChange={e => smx({ accent: e.target.value })} /></div></F>
                                <F label="Tag catégorie"><input className="si" value={maxtext.tag} onChange={e => smx({ tag: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Méta</p>
                                <F label="Afficher Date"><input type="checkbox" checked={maxtext.showDate ?? true} onChange={e => smx({ showDate: e.target.checked })} /></F>
                                {maxtext.showDate !== false && <F label="Date"><input className="si" value={maxtext.date} onChange={e => smx({ date: e.target.value })} /></F>}
                                
                                <F label="Afficher Source"><input type="checkbox" checked={maxtext.showSource ?? true} onChange={e => smx({ showSource: e.target.checked })} /></F>
                                {maxtext.showSource !== false && <F label="Source"><input className="si" value={maxtext.source} onChange={e => smx({ source: e.target.value })} /></F>}
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Citation</p>
                                <F label="Afficher Citation"><input type="checkbox" checked={maxtext.showQuote ?? true} onChange={e => smx({ showQuote: e.target.checked })} /></F>
                                {maxtext.showQuote !== false && <F label="Auteur citation"><input className="si" value={maxtext.quoteAuthor} onChange={e => smx({ quoteAuthor: e.target.value })} /></F>}
                            </section>
                        </>)}

                        {/* GRANULAR SIDEBAR */}
                        {template === 'GRANULAR' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={granular.brand} onChange={e => sgs({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={granular.accent} onChange={e => sgs({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={granular.accent} onChange={e => sgs({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Slide</p>
                                <F label="Tag"><input className="si" value={granular.tag} onChange={e => sgs({ tag: e.target.value })} /></F>
                                <F label="N° Slide"><input className="si" value={granular.slideNum} onChange={e => sgs({ slideNum: e.target.value })} /></F>
                                <F label="Handle footer"><input className="si" value={granular.footerHandle} onChange={e => sgs({ footerHandle: e.target.value })} /></F>
                                <F label="Mode"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={granular.dark} onChange={e => sgs({ dark: e.target.checked })} /><span className="sm text-[9px] uppercase text-gray-400">Force dark mode</span></label></F>
                            </section>
                        </>)}

                        {/* BIG_NUM SIDEBAR */}
                        {template === 'BIG_NUM' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={bignum.brand} onChange={e => sb2({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={bignum.accent} onChange={e => sb2({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={bignum.accent} onChange={e => sb2({ accent: e.target.value })} /></div></F>
                                <F label="Mode"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={bignum.dark} onChange={e => sb2({ dark: e.target.checked })} /><span className="sm text-[9px] uppercase text-gray-400">Force dark mode</span></label></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Données</p>
                                <F label="GROS CHIFFRE"><input className="si font-bold text-lg" value={bignum.num} onChange={e => sb2({ num: e.target.value })} /></F>
                                <F label="LABEL CHIFFRE"><input className="si" value={bignum.label} onChange={e => sb2({ label: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* VERSUS SIDEBAR */}
                        {template === 'VERSUS' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={versus.brand} onChange={e => sv({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={versus.accent} onChange={e => sv({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={versus.accent} onChange={e => sv({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Comparaison</p>
                                <div className="p-2 border border-white/10 rounded-lg space-y-2 bg-white/5">
                                    <F label="Titre Gauche"><input className="si" value={versus.leftTitle} onChange={e => sv({ leftTitle: e.target.value })} /></F>
                                </div>
                                <div className="p-2 border border-white/10 rounded-lg space-y-2 bg-white/5">
                                    <F label="Titre Droit"><input className="si" value={versus.rightTitle} onChange={e => sv({ rightTitle: e.target.value })} /></F>
                                </div>
                            </section>
                        </>)}

                        {/* CHECKLIST SIDEBAR */}
                        {template === 'CHECKLIST' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={checklist.brand} onChange={e => sk({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={checklist.accent} onChange={e => sk({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={checklist.accent} onChange={e => sk({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Checklist</p>
                                {[1, 2, 3, 4].map(num => (
                                    <div key={num} className="flex gap-2 items-center">
                                        <input type="checkbox" checked={(checklist as any)[`check${num}`]} onChange={e => sk({ [`check${num}`]: e.target.checked } as any)} />
                                        <input className="si flex-1" value={(checklist as any)[`item${num}`]} onChange={e => sk({ [`item${num}`]: e.target.value } as any)} placeholder={`Action ${num}...`} />
                                    </div>
                                ))}
                            </section>
                        </>)}

                        {/* INFO SIDEBAR */}
                        {template === 'INFO' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={info.brand} onChange={e => sis({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={info.accent} onChange={e => sis({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={info.accent} onChange={e => sis({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Slide</p>
                                <F label="Tag"><input className="si" value={info.tag} onChange={e => sis({ tag: e.target.value })} /></F>
                                <F label="N° Slide"><input className="si" value={info.slideNum} onChange={e => sis({ slideNum: e.target.value })} /></F>
                                <F label="Handle footer"><input className="si" value={info.footerHandle} onChange={e => sis({ footerHandle: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Bloc Action</p>
                                <F label="Titre action"><input className="si" value={info.actionTitle} onChange={e => sis({ actionTitle: e.target.value })} /></F>
                                <F label="Méta action"><input className="si" value={info.actionMeta} onChange={e => sis({ actionMeta: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* ANALYSIS SIDEBAR */}
                        {template === 'ANALYSIS' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={analysis.brand} onChange={e => sda({ brand: e.target.value })} /></F>
                                <F label="Réf. doc"><input className="si" value={analysis.refCode} onChange={e => sda({ refCode: e.target.value })} /></F>
                                <F label="Image URL"><input className="si" value={analysis.imageUrl} onChange={e => sda({ imageUrl: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Slide</p>
                                <div className="grid grid-cols-2 gap-2">
                                    <F label="N° Slide"><input className="si" value={analysis.slideNum} onChange={e => sda({ slideNum: e.target.value })} /></F>
                                    <F label="Total Slides"><input className="si" value={analysis.totalSlides} onChange={e => sda({ totalSlides: e.target.value })} /></F>
                                </div>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Item 1</p>
                                <F label="N°"><input className="si" value={analysis.item1Num} onChange={e => sda({ item1Num: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Item 2</p>
                                <F label="N°"><input className="si" value={analysis.item2Num} onChange={e => sda({ item2Num: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Item 3</p>
                                <F label="N°"><input className="si" value={analysis.item3Num} onChange={e => sda({ item3Num: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* OUTRO SIDEBAR */}
                        {template === 'OUTRO' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={outro.accent} onChange={e => sdo({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={outro.accent} onChange={e => sdo({ accent: e.target.value })} /></div></F>
                                <F label="Handle footer"><input className="si" value={outro.brandHandle} onChange={e => sdo({ brandHandle: e.target.value })} /></F>
                                <F label="Texte Curseur"><input className="si" value={outro.linkText} onChange={e => sdo({ linkText: e.target.value })} /></F>
                                <div className="grid grid-cols-2 gap-2">
                                    <F label="Année footer"><input className="si" value={outro.footerYear} onChange={e => sdo({ footerYear: e.target.value })} /></F>
                                    <F label="N° Slide"><input className="si" value={outro.number} onChange={e => sdo({ number: e.target.value })} /></F>
                                </div>
                            </section>
                        </>)}

                        <div className="sm text-[9px] text-gray-700 pt-2 border-t border-white/5 uppercase leading-relaxed">
                            <span style={{ color: curAccent }}>◈</span> Sélectionner du texte dans le canvas → toolbar de formatage<br />
                            <span style={{ color: curAccent }}>◎</span> Glisser l'image pour la repositionner
                        </div>

                        {/* COMPARISON_CHART SIDEBAR */}
                        {template === 'COMPARISON_CHART' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={chart.brand} onChange={e => scc({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={chart.accent} onChange={e => scc({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={chart.accent} onChange={e => scc({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <div className="flex justify-between items-center pb-1 border-b border-white/5">
                                    <p className="sm text-[9px] uppercase tracking-widest" style={{ color: curAccent }}>Barres ({chart.bars.length})</p>
                                    <button className="sm text-[8px] text-gray-500 hover:text-white uppercase" onClick={() => scc({ bars: [...chart.bars, { label: 'NOUVEAU', value: 10, color: '#555' }] })}>+ Ajouter</button>
                                </div>
                                {chart.bars.map((bar, i) => (
                                    <div key={i} className="p-2 border border-white/10 space-y-2 bg-white/5">
                                        <div className="flex justify-between items-center">
                                            <span className="sm text-[9px] text-gray-400 uppercase">Barre {i + 1}</span>
                                            {chart.bars.length > 1 && (<button onClick={() => scc({ bars: chart.bars.filter((_, j) => j !== i) })} className="sm text-[8px] text-red-500 hover:text-red-300">✕ Retirer</button>)}
                                        </div>
                                        <input className="si w-full" placeholder="Label" value={bar.label} onChange={e => { const b = [...chart.bars]; b[i] = { ...b[i], label: e.target.value }; scc({ bars: b }); }} />
                                        <div className="flex gap-2 items-center">
                                            <label className="sm text-[9px] text-gray-500 uppercase shrink-0">Valeur</label>
                                            <input type="number" className="si flex-1 w-20" value={bar.value} onChange={e => { const b = [...chart.bars]; b[i] = { ...b[i], value: +e.target.value }; scc({ bars: b }); }} />
                                            <input type="color" value={bar.color} onChange={e => { const b = [...chart.bars]; b[i] = { ...b[i], color: e.target.value }; scc({ bars: b }); }} className="w-8 h-7 cursor-pointer shrink-0" />
                                        </div>
                                    </div>
                                ))}
                            </section>
                        </>)}

                        {/* STACKED_DATA SIDEBAR */}
                        {template === 'STACKED_DATA' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={stackedData.brand} onChange={e => ssd({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={stackedData.accent} onChange={e => ssd({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={stackedData.accent} onChange={e => ssd({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <div className="flex justify-between items-center pb-1 border-b border-white/5">
                                    <p className="sm text-[9px] uppercase tracking-widest" style={{ color: curAccent }}>Colonnes ({stackedData.columns.length})</p>
                                    <button className="sm text-[8px] text-gray-500 hover:text-white uppercase" onClick={() => {
                                        const newCol: StackedColumn = { label: 'NOUVEAU', color: '#666' };
                                        const newRows = stackedData.rows.map(r => ({ ...r, cells: [...r.cells, { value: 0, label: 'NOUVEAU' }] }));
                                        ssd({ columns: [...stackedData.columns, newCol], rows: newRows });
                                    }}>+ Col</button>
                                </div>
                                {stackedData.columns.map((col, ci) => (
                                    <div key={ci} className="flex gap-2 items-center">
                                        <input type="color" value={col.color} onChange={e => { const cols = [...stackedData.columns]; cols[ci] = { ...cols[ci], color: e.target.value }; ssd({ columns: cols }); }} className="w-7 h-6 cursor-pointer shrink-0" />
                                        <input className="si flex-1" value={col.label} onChange={e => { const cols = [...stackedData.columns]; cols[ci] = { ...cols[ci], label: e.target.value }; ssd({ columns: cols }); }} />
                                        {stackedData.columns.length > 1 && (<button onClick={() => { const cols = stackedData.columns.filter((_, j) => j !== ci); const rows = stackedData.rows.map(r => ({ ...r, cells: r.cells.filter((_, j) => j !== ci) })); ssd({ columns: cols, rows }); }} className="sm text-[8px] text-red-500">✕</button>)}
                                    </div>
                                ))}
                            </section>
                            <section className="space-y-3">
                                <div className="flex justify-between items-center pb-1 border-b border-white/5">
                                    <p className="sm text-[9px] uppercase tracking-widest" style={{ color: curAccent }}>Secteurs ({stackedData.rows.length})</p>
                                    <button className="sm text-[8px] text-gray-500 hover:text-white uppercase" onClick={() => { const newRow: StackedRow = { sector: 'SECTEUR', cells: stackedData.columns.map(() => ({ value: 0, label: '' })) }; ssd({ rows: [...stackedData.rows, newRow] }); }}>+ Ligne</button>
                                </div>
                                {stackedData.rows.map((row, ri) => (
                                    <div key={ri} className="p-2 border border-white/10 space-y-2 bg-white/5">
                                        <div className="flex justify-between items-center">
                                            <input className="si flex-1 mr-2 font-bold text-[9px]" value={row.sector} onChange={e => { const rows = [...stackedData.rows]; rows[ri] = { ...rows[ri], sector: e.target.value }; ssd({ rows }); }} placeholder="Secteur..." />
                                            {stackedData.rows.length > 1 && (<button onClick={() => ssd({ rows: stackedData.rows.filter((_, j) => j !== ri) })} className="sm text-[8px] text-red-500">✕</button>)}
                                        </div>
                                        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(stackedData.columns.length, 3)}, 1fr)` }}>
                                            {row.cells.map((cell, ci) => (
                                                <div key={ci} className="space-y-0.5">
                                                    <p className="sm text-[7px] text-gray-600 uppercase truncate">{stackedData.columns[ci]?.label ?? `Col${ci + 1}`}</p>
                                                    <input type="number" className="si w-full text-xs" value={cell.value} onChange={e => { const rows = [...stackedData.rows]; const cells = [...rows[ri].cells]; cells[ci] = { ...cells[ci], value: +e.target.value }; rows[ri] = { ...rows[ri], cells }; ssd({ rows }); }} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        </>)}

                        {/* VOTE_TRACKER SIDEBAR */}
                        {template === 'VOTE_TRACKER' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={voteTracker.brand} onChange={e => svt({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={voteTracker.accent} onChange={e => svt({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={voteTracker.accent} onChange={e => svt({ accent: e.target.value })} /></div></F>
                                <F label="URL Photo sujet"><input className="si" value={voteTracker.imageUrl} onChange={e => svt({ imageUrl: e.target.value })} placeholder="https://..." /></F>
                                <F label="Nom du sujet"><input className="si" value={voteTracker.subjectName} onChange={e => svt({ subjectName: e.target.value })} /></F>
                                <F label="Variant / Numéro"><input className="si" value={voteTracker.variant} onChange={e => svt({ variant: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Couleurs verdicts</p>
                                <F label="🟢 POUR"><div className="flex gap-2"><input type="color" value={voteTracker.colorPour ?? '#1A1C1C'} onChange={e => svt({ colorPour: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={voteTracker.colorPour ?? '#1A1C1C'} onChange={e => svt({ colorPour: e.target.value })} /></div></F>
                                <F label="🔴 CONTRE"><div className="flex gap-2"><input type="color" value={voteTracker.colorContre ?? '#BC0100'} onChange={e => svt({ colorContre: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={voteTracker.colorContre ?? '#BC0100'} onChange={e => svt({ colorContre: e.target.value })} /></div></F>
                                <F label="⚫ ABST"><div className="flex gap-2"><input type="color" value={voteTracker.colorAbst ?? '#888888'} onChange={e => svt({ colorAbst: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={voteTracker.colorAbst ?? '#888888'} onChange={e => svt({ colorAbst: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <div className="flex justify-between items-center pb-1 border-b border-white/5">
                                    <p className="sm text-[9px] uppercase tracking-widest" style={{ color: curAccent }}>Votes ({voteTracker.votes.length})</p>
                                    <button className="sm text-[8px] text-gray-500 hover:text-white uppercase" onClick={() => svt({ votes: [...voteTracker.votes, { law: 'Nouvelle loi...', vote: 'CONTRE' }] })}>+ Vote</button>
                                </div>
                                {voteTracker.votes.map((vr, i) => (
                                    <div key={i} className="p-2 border border-white/10 space-y-2 bg-white/5">
                                        <div className="flex justify-between">
                                            <span className="sm text-[9px] text-gray-400 uppercase">Loi {i + 1}</span>
                                            {voteTracker.votes.length > 1 && (<button onClick={() => svt({ votes: voteTracker.votes.filter((_, j) => j !== i) })} className="sm text-[8px] text-red-500">✕</button>)}
                                        </div>
                                        <textarea className="si w-full resize-none h-14 text-[9px]" value={vr.law} onChange={e => { const vs = [...voteTracker.votes]; vs[i] = { ...vs[i], law: e.target.value }; svt({ votes: vs }); }} />
                                        <div className="flex gap-1">
                                            {(['POUR', 'CONTRE', 'ABST'] as const).map(v => (
                                                <button key={v} onClick={() => { const vs = [...voteTracker.votes]; vs[i] = { ...vs[i], vote: v }; svt({ votes: vs }); }}
                                                    className="flex-1 sm text-[9px] font-bold uppercase py-1 border transition-colors"
                                                    style={{ borderColor: vr.vote === v ? curAccent : '#333', background: vr.vote === v ? curAccent : 'transparent', color: vr.vote === v ? '#fff' : '#666' }}>
                                                    {v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </section>
                        </>)}

                        {/* TERRITORY_RADAR SIDEBAR */}
                        {template === 'TERRITORY_RADAR' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={territoryRadar.brand} onChange={e => str({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={territoryRadar.accent} onChange={e => str({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={territoryRadar.accent} onChange={e => str({ accent: e.target.value })} /></div></F>
                                <F label="Source"><input className="si" value={territoryRadar.source} onChange={e => str({ source: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Légende couleurs</p>
                                {territoryRadar.legend.map((l, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <input type="color" value={l.color} onChange={e => { const lg = [...territoryRadar.legend]; lg[i] = { ...lg[i], color: e.target.value }; str({ legend: lg }); }} className="w-7 h-6 cursor-pointer shrink-0" />
                                        <input className="si flex-1" value={l.label} onChange={e => { const lg = [...territoryRadar.legend]; lg[i] = { ...lg[i], label: e.target.value }; str({ legend: lg }); }} />
                                        {territoryRadar.legend.length > 1 && <button onClick={() => str({ legend: territoryRadar.legend.filter((_, j) => j !== i) })} className="sm text-[8px] text-red-500">✕</button>}
                                    </div>
                                ))}
                                <button className="sm text-[8px] text-gray-500 hover:text-white uppercase" onClick={() => str({ legend: [...territoryRadar.legend, { color: '#777', label: 'NOUVELLE ZONE' }] })}>+ Zone</button>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Stats</p>
                                {territoryRadar.stats.map((s, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <input className="si flex-1" value={s.label} onChange={e => { const st = [...territoryRadar.stats]; st[i] = { ...st[i], label: e.target.value }; str({ stats: st }); }} placeholder="Label..." />
                                        <input className="si w-20" value={s.value} onChange={e => { const st = [...territoryRadar.stats]; st[i] = { ...st[i], value: e.target.value }; str({ stats: st }); }} placeholder="Valeur" />
                                        {territoryRadar.stats.length > 1 && <button onClick={() => str({ stats: territoryRadar.stats.filter((_, j) => j !== i) })} className="sm text-[8px] text-red-500">✕</button>}
                                    </div>
                                ))}
                                <button className="sm text-[8px] text-gray-500 hover:text-white uppercase" onClick={() => str({ stats: [...territoryRadar.stats, { label: 'STAT', value: '—' }] })}>+ Stat</button>
                            </section>
                        </>)}

                        {/* DECODING SIDEBAR */}
                        {template === 'DECODING' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={decoding.brand} onChange={e => sdec({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={decoding.accent} onChange={e => sdec({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={decoding.accent} onChange={e => sdec({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Décodage</p>
                                <F label="🔤 Mot de novlangue"><input className="si font-bold text-lg" value={decoding.jargonTerm} onChange={e => sdec({ jargonTerm: e.target.value })} /></F>
                                <F label="Version officielle"><textarea className="si w-full resize-none h-14 text-[9px]" value={decoding.officialDef} onChange={e => sdec({ officialDef: e.target.value })} /></F>
                                <F label="Vérité terrain"><textarea className="si w-full resize-none h-20 text-[9px]" value={decoding.realityCheck} onChange={e => sdec({ realityCheck: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* CHRONO_LOCK SIDEBAR */}
                        {template === 'CHRONO_LOCK' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={chronoLock.brand} onChange={e => scl({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={chronoLock.accent} onChange={e => scl({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={chronoLock.accent} onChange={e => scl({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <div className="flex justify-between items-center pb-1 border-b border-white/5">
                                    <p className="sm text-[9px] uppercase tracking-widest" style={{ color: curAccent }}>Événements ({chronoLock.timeline.length})</p>
                                    <button className="sm text-[8px] text-gray-500 hover:text-white uppercase" onClick={() => scl({ timeline: [...chronoLock.timeline, { date: 'DATE', event: 'Événement...', impact: 'Impact...' }] })}>+ Ajouter</button>
                                </div>
                                {chronoLock.timeline.map((ev, i) => (
                                    <div key={i} className="p-2 border border-white/10 space-y-2 bg-white/5">
                                        <div className="flex justify-between">
                                            <input className="si flex-1 mr-2 font-bold text-[9px]" value={ev.date} onChange={e => { const tl = [...chronoLock.timeline]; tl[i] = { ...tl[i], date: e.target.value }; scl({ timeline: tl }); }} placeholder="Date..." />
                                            {chronoLock.timeline.length > 1 && <button onClick={() => scl({ timeline: chronoLock.timeline.filter((_, j) => j !== i) })} className="sm text-[8px] text-red-500">✕</button>}
                                        </div>
                                        <input className="si w-full text-[9px]" value={ev.event} onChange={e => { const tl = [...chronoLock.timeline]; tl[i] = { ...tl[i], event: e.target.value }; scl({ timeline: tl }); }} placeholder="Événement..." />
                                        <input className="si w-full text-[9px]" value={ev.impact} onChange={e => { const tl = [...chronoLock.timeline]; tl[i] = { ...tl[i], impact: e.target.value }; scl({ timeline: tl }); }} placeholder="Impact concret..." />
                                    </div>
                                ))}
                            </section>
                        </>)}

                        {/* IMPACT_QUOTE SIDEBAR */}
                        {template === 'IMPACT_QUOTE' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={impactQuote.brand} onChange={e => siq({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={impactQuote.accent} onChange={e => siq({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={impactQuote.accent} onChange={e => siq({ accent: e.target.value })} /></div></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Citation</p>
                                <F label="Citation (≤150ch)"><textarea className="si w-full resize-none h-28 text-[9px]" value={impactQuote.largeQuote} onChange={e => siq({ largeQuote: e.target.value })} /></F>
                                <F label="Auteur"><input className="si" value={impactQuote.author} onChange={e => siq({ author: e.target.value })} /></F>
                                <F label="Contexte (≤50ch)"><input className="si" value={impactQuote.context} onChange={e => siq({ context: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* SOCIAL_COST SIDEBAR */}
                        {template === 'SOCIAL_COST' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={socialCost.brand} onChange={e => ssc({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={socialCost.accent} onChange={e => ssc({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={socialCost.accent} onChange={e => ssc({ accent: e.target.value })} /></div></F>
                                <F label="Audience cible"><input className="si font-bold" value={socialCost.targetAudience} onChange={e => ssc({ targetAudience: e.target.value })} /></F>
                            </section>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Chiffres</p>
                                <F label="Perte mensuelle"><input className="si font-bold text-lg" value={socialCost.monthlyLoss} onChange={e => ssc({ monthlyLoss: e.target.value })} /></F>
                                <F label="Impact annuel"><input className="si font-bold text-lg" value={socialCost.annualImpact} onChange={e => ssc({ annualImpact: e.target.value })} /></F>
                                <F label="Conséquence (≤100ch)"><textarea className="si w-full resize-none h-16 text-[9px]" value={socialCost.consequence} onChange={e => ssc({ consequence: e.target.value })} /></F>
                                <F label="Note/Source"><input className="si" value={socialCost.note} onChange={e => ssc({ note: e.target.value })} /></F>
                            </section>
                        </>)}

                        {/* VIDEO_NOTE SIDEBAR */}
                        {template === 'VIDEO_NOTE' && (<>
                            <section className="space-y-3">
                                <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Général</p>
                                <F label="Marque"><input className="si" value={videoNote.brand} onChange={e => svn({ brand: e.target.value })} /></F>
                                <F label="Couleur accent"><div className="flex gap-2"><input type="color" value={videoNote.accent} onChange={e => svn({ accent: e.target.value })} className="w-8 h-7 shrink-0 cursor-pointer" /><input className="si flex-1" value={videoNote.accent} onChange={e => svn({ accent: e.target.value })} /></div></F>
                                <F label="Vidéo (URL ou Fichier)">
                                    <div className="space-y-2">
                                        <input className="si w-full" value={videoNote.videoUrl} onChange={e => svn({ videoUrl: e.target.value })} placeholder="https://..." />
                                        <div className="relative">
                                            <input type="file" accept="video/*" className="hidden" id="video-upload" onChange={handleVideoUpload} />
                                            <label htmlFor="video-upload" className="w-full py-2 px-3 border border-white/20 bg-white/5 hover:bg-white/10 text-[10px] uppercase font-bold text-center cursor-pointer flex items-center justify-center gap-2" style={{ color: curAccent }}>
                                                <span>📁 Upload vidéo locale</span>
                                            </label>
                                        </div>
                                    </div>
                                </F>
                            </section>
                             <section className="space-y-3">
                                 <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Cadrage & Zoom</p>
                                 <F label={`Zoom: ${(videoNote.videoZoom || 1).toFixed(2)}x`}>
                                     <input type="range" min="1" max="3" step="0.01" value={videoNote.videoZoom || 1} onChange={e => svn({ videoZoom: parseFloat(e.target.value) })} />
                                 </F>
                                 <div className="grid grid-cols-2 gap-2">
                                     <F label="X Offset">
                                         <input className="si" type="number" value={videoNote.videoX || 0} onChange={e => svn({ videoX: parseInt(e.target.value) || 0 })} />
                                     </F>
                                     <F label="Y Offset">
                                         <input className="si" type="number" value={videoNote.videoY || 0} onChange={e => svn({ videoY: parseInt(e.target.value) || 0 })} />
                                     </F>
                                 </div>
                                 <button className="w-full py-1 border border-white/10 bg-white/5 text-[8px] uppercase hover:bg-white/20" onClick={() => svn({ videoX: 0, videoY: 0, videoZoom: 1 })}>Réinitialiser</button>
                             </section>
                             <section className="space-y-3">
                                 <p className="sm text-[9px] uppercase tracking-widest pb-1 border-b border-white/5" style={{ color: curAccent }}>Contenu</p>
                                 <F label="Titre slide"><input className="si" value={videoNote.headline} onChange={e => svn({ headline: e.target.value })} /></F>
                                 <F label="Annotation"><textarea className="si w-full resize-none h-20 text-[9px]" value={videoNote.annotation} onChange={e => svn({ annotation: e.target.value })} /></F>
                             </section>
                        </>)}

                    </div>
                </aside>

                {/* CANVAS */}
                <main className="flex-1 overflow-auto bg-zinc-950 flex items-center justify-center p-10 relative sb"
                    style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.04) 1px,transparent 0)', backgroundSize: '36px 36px' }}>
                    <span className="absolute top-4 left-5 sm text-[9px] uppercase tracking-widest opacity-20 select-none pointer-events-none">Live Preview — {template} — 1080×1350 (4:5)</span>

                    {/* ════ COVER ════ */}
                    {template === 'COVER' && (
                        <div style={{ boxShadow: `20px 20px 0 ${cover.accent}55` }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] border-[10px] border-black overflow-hidden" style={{ backgroundColor: cover.bg }}>
                                {/* Image — no transform:scale, uses absolute size for html2canvas compat */}
                                {cover.imageUrl && <DraggableImage src={cover.imageUrl} zoom={cover.zoom} grayscale={cover.grayscale} posX={cover.posX} posY={cover.posY} onPosChange={(x, y) => sc({ posX: x, posY: y })} />}
                                {/* Halftone overlay — real DOM div */}
                                <div className="absolute inset-0 z-10 opacity-25 halftone pointer-events-none"></div>
                                {/* Noise overlay — real DOM div (pseudo-elements not captured by html2canvas) */}
                                <div className="noise-overlay" style={{ zIndex: 11 }}></div>
                                <div className="relative z-30 h-full flex flex-col justify-between p-9">
                                    <div className="flex justify-between items-start border-b-[3px] border-black pb-3">
                                        <span className="sm text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2.5 py-1">Issue #{cover.issueNum}</span>
                                        <span className="sm text-[9px] uppercase tracking-widest text-black font-bold">{cover.brand}</span>
                                    </div>
                                    <div className="flex-grow flex items-center justify-center relative">
                                        <div className="absolute inset-x-[-36px] h-48 transform -skew-y-3 border-y-[6px] border-black shadow-xl" style={{ backgroundColor: cover.bg }}></div>
                                        <EditZone html={cover.headline} onChange={h => sc({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                            className="relative z-10 pd font-black text-[76px] leading-[0.82] text-center text-black uppercase italic tracking-tighter" />
                                    </div>
                                    <div className="border-t-[6px] border-black pt-4 flex justify-between items-end">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="sm text-[8px] font-bold uppercase text-black">Temps de lecture: {cover.readTime}</span>
                                            <span className="sm text-[8px] font-bold uppercase text-black">Auteur: {cover.author}</span>
                                        </div>
                                        <div className="flex items-center gap-2 pl-3 border-l-2 border-black">
                                            <span className="font-bold text-[10px] uppercase tracking-widest text-black italic">{cover.swipeLabel}</span>
                                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={cover.accent} strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-1/3 left-5 w-5 h-5 bg-black z-40"></div>
                                <div className="absolute top-1/3 left-12 w-5 h-5 border-[3px] border-black z-40"></div>
                                <div className="absolute bottom-10 right-10 rounded-full z-20 mix-blend-hard-light" style={{ width: 88, height: 88, backgroundColor: cover.accent }}></div>
                            </div>
                        </div>
                    )}

                    {/* ════ NEWS ════ */}
                    {template === 'NEWS' && (
                        <div style={{ boxShadow: '0 0 50px rgba(0,0,0,.7)' }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] bg-white border-[8px] border-black overflow-hidden flex flex-col">
                                {/* Noise overlay for whole card */}
                                <div className="noise-overlay" style={{ zIndex: 100 }}></div>
                                <div className="relative h-[60%] border-b-[8px] border-black overflow-hidden bg-zinc-700 shrink-0">
                                    <div className="absolute top-0 left-0 z-30 px-4 py-2 border-r-[4px] border-b-[4px] border-black" style={{ backgroundColor: news.accent }}>
                                        <span className="sm text-white text-[9px] tracking-[0.2em] uppercase font-bold">{news.brand} {news.category}</span>
                                    </div>
                                    {news.imageUrl && <DraggableImage src={news.imageUrl} zoom={news.zoom} grayscale={news.grayscale} posX={news.posX} posY={news.posY} onPosChange={(x, y) => sn({ posX: x, posY: y })} />}
                                    <div className="absolute inset-0 z-10 opacity-15 halftone pointer-events-none"></div>
                                </div>
                                <div className="flex-1 bg-white px-6 pt-4 pb-5 flex flex-col justify-between text-black">
                                    <div className="flex justify-between items-center border-b-2 border-black pb-2">
                                        <span className="sm text-[9px] font-bold uppercase tracking-widest">{news.date}</span>
                                        <span className="sm text-[9px] font-bold uppercase tracking-widest">{news.topic}</span>
                                    </div>
                                    <div className="flex-1 flex items-center py-2">
                                        <EditZone html={news.headline} onChange={h => sn({ headline: h })} label="TITRE" stickerPos="-top-5 left-0"
                                            className="pd font-black text-[40px] leading-[0.9] uppercase text-black" />
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="sm text-[8px] uppercase text-zinc-400 font-bold">Rédaction Quotidienne</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-[9px] uppercase tracking-widest">Lire la suite</span>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={news.accent} strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════ MANIFESTO ════ */}
                    {template === 'MANIFESTO' && (
                        <div style={{ boxShadow: `18px 18px 0 ${manifesto.accent}44` }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] split-bg border-4 border-black overflow-hidden flex flex-col text-black">
                                {/* Noise overlay */}
                                <div className="noise-overlay" style={{ zIndex: 100 }}></div>
                                <div className="w-full bg-black h-11 flex items-center justify-between px-5 shrink-0 z-20">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 bg-white"></div>
                                        <span className="ab text-white text-base tracking-tighter uppercase">{manifesto.brand.split(' ')[0]}</span>
                                    </div>
                                    <span className="sm text-white text-[8px] uppercase tracking-widest">{manifesto.docNum}</span>
                                </div>
                                <div className="flex-grow flex flex-col p-6 overflow-hidden">
                                    <EditZone html={manifesto.headline} onChange={h => sm2({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                        className="pd font-black leading-[0.9] mb-5 tracking-tight" style={{ fontSize: manifesto.titleSize }} />
                                    <div className="flex-grow flex gap-5 ir text-[10px] leading-[1.45] overflow-hidden">
                                        <div className="w-1/2 flex flex-col overflow-hidden">
                                            <EditZone html={manifesto.bodyLeft} onChange={h => sm2({ bodyLeft: h })} label="COL. GAUCHE" stickerPos="-top-5 left-0"
                                                className="mb-3 font-semibold text-justify" />
                                            <div className="mt-auto border-l-[3px] pl-2 py-0.5" style={{ borderColor: manifesto.accent }}>
                                                <p className="sm text-[7px] uppercase text-gray-500 mb-0.5">Status:</p>
                                                <p className="ab uppercase text-[11px] leading-none">{manifesto.metaLeft}</p>
                                            </div>
                                        </div>
                                        <div className="w-1/2 flex flex-col overflow-hidden">
                                            <EditZone html={manifesto.bodyRight} onChange={h => sm2({ bodyRight: h })} label="COL. DROITE" stickerPos="-top-5 right-0"
                                                className="mb-3 text-justify" />
                                            <div className="mt-auto bg-black text-white p-2">
                                                <div className="flex items-center gap-1 mb-1">
                                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                                                    <span className="sm text-[7px] uppercase">{manifesto.actionLabel}</span>
                                                </div>
                                                <p className="ab text-[10px] uppercase leading-none">{manifesto.metaRight}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="h-2.5 w-full flex shrink-0">
                                    <div className="w-1/2 bg-black border-r border-white"></div>
                                    <div className="w-1/2" style={{ backgroundColor: manifesto.accent }}></div>
                                </div>
                                <div className="absolute top-[44px] bottom-[10px] left-1/2 w-px bg-black opacity-10 pointer-events-none"></div>
                            </div>
                        </div>
                    )}

                    {/* ════ MAX TEXT ════ */}
                    {template === 'MAXTEXT' && (
                        <div style={{ boxShadow: `8px 8px 0 ${maxtext.accent}` }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] border-[6px] border-black overflow-hidden flex flex-col" style={{ backgroundColor: '#F9FAFB' }}>
                                <div className="noise-overlay" style={{ opacity: 0.04, zIndex: 40 }}></div>
                                {/* Brand pill top-right */}
                                <div className="absolute top-0 right-0 z-30 px-3 py-1 sm font-bold text-[10px] uppercase tracking-widest border-b-2 border-l-2 border-black text-white" style={{ backgroundColor: maxtext.accent }}>{maxtext.brand}</div>
                                <div className="relative z-10 flex-grow flex flex-col px-8 pt-8 pb-3 overflow-hidden">
                                    {/* Title */}
                                    <div className="relative mb-4 pb-3 border-b-2 border-black">
                                        <EditZone html={maxtext.headline} onChange={h => smx({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                            className="pd font-bold text-[30px] leading-tight text-black" />
                                        <div className="absolute -bottom-[2px] left-0 h-[3px] w-1/4" style={{ backgroundColor: maxtext.accent }}></div>
                                    </div>
                                    {/* Lead */}
                                    <div className="flex-grow overflow-hidden flex flex-col">
                                        <EditZone html={maxtext.leadParagraph} onChange={h => smx({ leadParagraph: h })} label="ANALYSE" stickerPos="-top-5 left-0"
                                            className="ir text-[17px] leading-[1.65] text-black text-justify mb-3 maxtext-body" />
                                        {/* Body mono */}
                                        <EditZone html={maxtext.bodyParagraph} onChange={h => smx({ bodyParagraph: h })} label="DÉTAIL" stickerPos="-top-5 right-0"
                                            className="sm text-[14px] leading-[1.6] text-gray-700 text-justify mb-3 maxtext-body" />
                                    </div>
                                    {/* Quote */}
                                    {maxtext.showQuote !== false && (
                                        <div className="relative border-l-2 p-3 bg-gray-100/50 mt-auto" style={{ borderColor: maxtext.accent }}>
                                            <EditZone html={maxtext.quote} onChange={h => smx({ quote: h })} label="CITATION" stickerPos="-top-5 left-0"
                                                className="sm text-[13px] leading-snug text-black italic" />
                                            <span className="sm text-[10px] uppercase font-bold mt-1 block" style={{ color: maxtext.accent }}>{maxtext.quoteAuthor}</span>
                                        </div>
                                    )}
                                </div>
                                {/* Footer */}
                                {(maxtext.showDate !== false || maxtext.showSource !== false) && (
                                    <div className="border-t border-dashed border-gray-400 px-8 py-2 flex justify-between items-end shrink-0 bg-[#F9FAFB] z-10">
                                        {maxtext.showDate !== false ? (
                                            <div className="flex flex-col">
                                                <span className="sm text-[8px] uppercase text-gray-400">Date</span>
                                                <span className="sm font-bold text-[11px] text-black">{maxtext.date}</span>
                                            </div>
                                        ) : <div></div>}
                                        {maxtext.showSource !== false && (
                                            <div className="flex flex-col text-right">
                                                <span className="sm text-[8px] uppercase text-gray-400">Source</span>
                                                <span className="sm font-bold text-[11px] text-black">{maxtext.source}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ════ GRANULAR ════ */}
                    {template === 'GRANULAR' && (
                        <div style={{ boxShadow: '20px 20px 0 rgba(0,0,0,1)' }}>
                            <div ref={exportRef}
                                className="relative w-[560px] h-[700px] overflow-hidden border-4 border-black flex flex-col"
                                style={{ backgroundColor: granular.dark ? '#0F0F0F' : '#F3F4F6', color: granular.dark ? '#fff' : '#000' }}>
                                {/* Geometric bg */}
                                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                    <div style={{
                                        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
                                        backgroundColor: granular.dark ? '#fff' : '#000', borderLeft: `8px solid ${granular.accent}`,
                                        opacity: 0.1, transform: 'skewX(-12deg) translateX(25%)'
                                    }}></div>
                                    <div style={{
                                        position: 'absolute', top: '15%', left: 0, width: '100%', height: 8,
                                        backgroundColor: granular.dark ? '#fff' : '#000', transform: 'rotate(-1deg)'
                                    }}></div>
                                    <div style={{
                                        position: 'absolute', bottom: '10%', left: 0, width: '100%', height: 16,
                                        backgroundColor: granular.dark ? '#fff' : '#000', transform: 'rotate(1deg)'
                                    }}></div>
                                </div>
                                <div className="noise-overlay" style={{ opacity: 0.08, zIndex: 5 }}></div>
                                {/* Header */}
                                <header className="relative z-10 px-8 pt-10 pb-4 flex justify-between items-end border-b-4 shrink-0"
                                    style={{ borderColor: granular.dark ? '#fff' : '#000', backgroundColor: granular.dark ? '#000' : '#fff' }}>
                                    <div className="flex flex-col">
                                        <span className="sm text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: granular.accent }}>{granular.tag}</span>
                                        <EditZone html={granular.headline} onChange={h => sgs({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                            className="ab text-[36px] leading-none uppercase" style={{ color: granular.dark ? '#fff' : '#000' }} />
                                    </div>
                                    <div className="text-right">
                                        <div className="sm text-[36px] font-bold leading-none" style={{ color: granular.dark ? '#fff' : '#000' }}>{granular.slideNum}</div>
                                        <div className="sm text-[9px] uppercase opacity-40" style={{ color: granular.dark ? '#fff' : '#000' }}>Slide</div>
                                    </div>
                                </header>
                                {/* Main */}
                                <main className="relative z-10 flex-grow p-7 flex flex-col justify-between gap-4">
                                    {/* Body card */}
                                    <div className="relative p-5 border-2 flex-grow flex flex-col justify-center" style={{
                                        backgroundColor: granular.dark ? '#18181b' : '#fff',
                                        borderColor: granular.dark ? '#fff' : '#000',
                                        boxShadow: `8px 8px 0 ${granular.accent}`,
                                        transform: 'rotate(1deg)'
                                    }}>
                                        <EditZone html={granular.body} onChange={h => sgs({ body: h })} label="CORPS" stickerPos="-top-5 right-0"
                                            className="ir text-[22px] font-bold leading-snug mb-4" style={{ color: granular.dark ? '#e5e5e5' : '#000' }} />
                                        <EditZone html={granular.bodyMono} onChange={h => sgs({ bodyMono: h })} label="CORPS 2" stickerPos="-top-5 left-0"
                                            className="sm text-[16px] leading-relaxed text-justify" style={{ opacity: 0.75, color: granular.dark ? '#aaa' : '#333' }} />
                                    </div>
                                    {/* Quote (torn edge) */}
                                    <div className="relative">
                                        <div className="absolute -top-3 -left-2 px-2 py-1 sm text-[9px] font-bold uppercase z-20"
                                            style={{ backgroundColor: granular.dark ? '#fff' : '#000', color: granular.dark ? '#000' : '#fff' }}>Témoignage Clé</div>
                                        <div className="p-5 border-4 border-black relative overflow-hidden" style={{
                                            backgroundColor: granular.accent,
                                            clipPath: 'polygon(0% 0%,100% 0%,100% 90%,95% 95%,90% 90%,85% 95%,80% 90%,75% 95%,70% 90%,65% 95%,60% 90%,55% 95%,50% 90%,45% 95%,40% 90%,35% 95%,30% 90%,25% 95%,20% 90%,15% 95%,10% 90%,5% 95%,0% 90%)'
                                        }}>
                                            <EditZone html={granular.quote} onChange={h => sgs({ quote: h })} label="CITATION" stickerPos="-top-5 left-0"
                                                className="ab text-[16px] uppercase leading-tight text-white" style={{ mixBlendMode: 'hard-light' as any }} />
                                        </div>
                                    </div>
                                </main>
                                {/* Footer */}
                                <footer className="relative z-10 px-5 py-3 flex justify-between items-center border-t-4 shrink-0"
                                    style={{ backgroundColor: granular.dark ? '#fff' : '#000', color: granular.dark ? '#000' : '#fff', borderColor: granular.accent }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: granular.accent }}></div>
                                        <span className="ab text-[18px] uppercase tracking-widest">{granular.brand}</span>
                                    </div>
                                    <span className="sm text-[10px]">{granular.footerHandle}</span>
                                </footer>
                            </div>
                        </div>
                    )}

                    {/* ════ BIG NUM ════ */}
                    {template === 'BIG_NUM' && (
                        <div style={{ boxShadow: `15px 15px 0 ${bignum.accent}55` }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] overflow-hidden border-4 border-black flex flex-col"
                                style={{ backgroundColor: bignum.dark ? '#000' : '#fff', color: bignum.dark ? '#fff' : '#000' }}>
                                <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: `radial-gradient(${bignum.accent} 2px, transparent 2px)`, backgroundSize: '24px 24px' }}></div>
                                <div className="noise-overlay" style={{ opacity: 0.1, zIndex: 10 }}></div>
                                <header className="p-6 border-b-4 border-black flex justify-between items-center z-20 bg-inherit">
                                    <span className="ab text-xl uppercase tracking-tighter" style={{ color: bignum.accent }}>{bignum.brand} DATA</span>
                                    <div className="w-8 h-8 flex items-center justify-center border-2 border-black font-bold">!</div>
                                </header>
                                <main className="flex-1 flex flex-col justify-center items-center p-8 z-20 text-center relative">
                                    <EditZone html={bignum.headline} onChange={h => sb2({ headline: h })} label="TITRE" stickerPos="-top-8 left-1/2 -translate-x-1/2"
                                        className="sm text-[10px] font-bold uppercase tracking-[.3em] mb-4 opacity-50" />
                                    <div className="relative">
                                        <span className="ab text-[180px] leading-none tracking-tighter" style={{ WebkitTextStroke: bignum.dark ? '2px #fff' : '2px #000', color: 'transparent' }}>{bignum.num}</span>
                                        <span className="absolute inset-0 ab text-[180px] leading-none tracking-tighter mix-blend-overlay" style={{ color: bignum.accent, opacity: 0.6 }}>{bignum.num}</span>
                                    </div>
                                    <div className="mt-2 bg-black text-white px-5 py-1.5 transform -rotate-1 skew-x-12 inline-block shadow-lg">
                                        <EditZone html={bignum.label} onChange={h => sb2({ label: h })} label="UNITÉ" stickerPos="top-0 right-0"
                                            className="ab text-2xl font-black uppercase italic" />
                                    </div>
                                    <div className="mt-8 max-w-[320px]">
                                        <EditZone html={bignum.sub} onChange={h => sb2({ sub: h })} label="CONCOURS" stickerPos="bottom-0"
                                            className="ir text-lg font-bold leading-tight" />
                                    </div>
                                </main>
                                <footer className="p-4 border-t-4 border-black flex justify-center z-20 bg-inherit">
                                    <div className="flex gap-2">
                                        {Array.from({ length: 12 }).map((_, i) => (<div key={i} className="w-1.5 h-6" style={{ backgroundColor: i % 2 === 0 ? bignum.accent : (bignum.dark ? '#fff' : '#000') }}></div>))}
                                    </div>
                                </footer>
                            </div>
                        </div>
                    )}

                    {/* ════ VERSUS ════ */}
                    {template === 'VERSUS' && (
                        <div style={{ boxShadow: '0 0 40px rgba(0,0,0,.5)' }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] overflow-hidden border-4 border-black flex flex-col">
                                <div className="absolute inset-0 flex">
                                    <div className="w-1/2 bg-white flex flex-col border-r-2 border-black">
                                        <div className="h-14 bg-black text-white flex items-center justify-center ab text-sm uppercase px-4 text-center">
                                            <EditZone html={versus.leftTitle} onChange={h => sv({ leftTitle: h })} label="TITRE G" stickerPos="top-0" />
                                        </div>
                                        <div className="flex-1 p-8 flex items-center justify-center text-black text-center relative">
                                            <EditZone html={versus.leftBody} onChange={h => sv({ leftBody: h })} label="CORPS G" stickerPos="bottom-2"
                                                className="ir font-bold text-xl leading-snug italic" />
                                        </div>
                                    </div>
                                    <div className="w-1/2 bg-[#0F0F0F] flex flex-col">
                                        <div className="h-14 flex items-center justify-center ab text-sm uppercase px-4 text-center text-white" style={{ backgroundColor: versus.accent }}>
                                            <EditZone html={versus.rightTitle} onChange={h => sv({ rightTitle: h })} label="TITRE D" stickerPos="top-0" />
                                        </div>
                                        <div className="flex-1 p-8 flex items-center justify-center text-white text-center relative">
                                            <EditZone html={versus.rightBody} onChange={h => sv({ rightBody: h })} label="CORPS D" stickerPos="bottom-2"
                                                className="ir font-bold text-xl leading-snug" />
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                                    <div className="w-20 h-20 bg-black border-4 border-white flex items-center justify-center ab text-4xl text-white italic transform -rotate-12 shadow-2xl">VS</div>
                                </div>
                                <div className="absolute top-0 left-0 w-full z-10 p-3 pointer-events-none">
                                    <EditZone html={versus.headline} onChange={h => sv({ headline: h })} label="BANNER" stickerPos="top-5 right-5"
                                        className="sm text-[8px] font-black uppercase tracking-[0.4em] text-center bg-white/10 backdrop-blur-sm py-1 border border-black/10 text-gray-500" />
                                </div>
                                <div className="absolute bottom-5 left-5 ab text-[12px] opacity-20 pointer-events-none">L'ASSEZ / DECODAGE</div>
                            </div>
                        </div>
                    )}

                    {/* ════ CHECKLIST ════ */}
                    {template === 'CHECKLIST' && (
                        <div style={{ boxShadow: `12px 12px 0 ${checklist.accent}` }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] bg-white overflow-hidden border-4 border-black flex flex-col p-8">
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '40px 40px', backgroundPosition: '0 0, 20px 20px' }}></div>
                                <header className="relative z-10 mb-8 border-l-[10px] border-black pl-5">
                                    <EditZone html={checklist.headline} onChange={h => sk({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                        className="pd font-black text-5xl leading-none uppercase tracking-tighter" />
                                    <span className="sm text-[10px] uppercase font-bold text-gray-400 mt-2 block tracking-widest">{checklist.brand} / PROTOCOLE D'ACTION</span>
                                </header>
                                <main className="relative z-10 flex-grow space-y-5 flex flex-col justify-center">
                                    {[1, 2, 3, 4].map(num => (
                                        <div key={num} className="flex gap-4 items-center group">
                                            <div className="w-10 h-10 border-4 border-black flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                                                onClick={() => sk({ [`check${num}`]: !(checklist as any)[`check${num}`] } as any)}
                                                style={{ backgroundColor: (checklist as any)[`check${num}`] ? checklist.accent : 'transparent' }}>
                                                {(checklist as any)[`check${num}`] && <div className="w-5 h-5 bg-white"></div>}
                                            </div>
                                            <div className="flex-1 relative">
                                                <EditZone html={(checklist as any)[`item${num}`]} onChange={h => sk({ [`item${num}`]: h } as any)} label={`ITEM ${num}`} stickerPos="top-0 right-0"
                                                    className={`ab text-2xl uppercase transition-all ${(checklist as any)[`check${num}`] ? 'line-through opacity-50' : ''}`} />
                                            </div>
                                        </div>
                                    ))}
                                </main>
                                <footer className="relative z-10 mt-8 pt-5 border-t-2 border-black/10 flex justify-between items-end">
                                    <div className="flex -space-x-2">
                                        {Array.from({ length: 5 }).map((_, i) => (<div key={i} className="w-8 h-8 rounded-full border-2 border-black" style={{ backgroundColor: i === 0 ? checklist.accent : '#eee' }}></div>))}
                                    </div>
                                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                                </footer>
                                <div className="absolute top-10 right-10 w-20 h-20 opacity-10 pointer-events-none select-none">
                                    <svg viewBox="0 0 24 24" fill="black"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════ INFO SLIDE ════ */}
                    {template === 'INFO' && (
                        <div style={{ boxShadow: '0 0 50px rgba(0,0,0,.7)' }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] overflow-hidden border-4 border-black flex flex-col" style={{ backgroundColor: '#F3F4F6' }}>
                                {/* bg decorations */}
                                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                    <div style={{
                                        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
                                        backgroundColor: '#000', borderLeft: `8px solid ${info.accent}`,
                                        opacity: 0.1, transform: 'skewX(-12deg) translateX(25%)'
                                    }}></div>
                                    <div style={{ position: 'absolute', top: '15%', left: 0, width: '100%', height: 8, backgroundColor: '#000', transform: 'rotate(-1deg)' }}></div>
                                    <div style={{ position: 'absolute', bottom: '10%', left: 0, width: '100%', height: 16, backgroundColor: '#000', transform: 'rotate(1deg)' }}></div>
                                </div>
                                <div className="noise-overlay" style={{ opacity: 0.08, zIndex: 5 }}></div>
                                {/* Header */}
                                <header className="relative z-20 px-8 pt-10 pb-4 flex justify-between items-end border-b-4 border-black bg-white shrink-0">
                                    <div className="flex flex-col">
                                        <span className="sm text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: info.accent }}>{info.tag}</span>
                                        <EditZone html={info.headline} onChange={h => sis({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                            className="pd font-black text-[36px] leading-none text-black uppercase tracking-tighter" />
                                    </div>
                                    <div className="text-right">
                                        <div className="sm text-[36px] font-bold text-black leading-none">{info.slideNum}</div>
                                        <div className="sm text-[9px] uppercase text-gray-400">Slide</div>
                                    </div>
                                </header>
                                {/* Main */}
                                <main className="relative z-20 flex-grow p-7 flex flex-col justify-between gap-5">
                                    {/* Body card */}
                                    <div className="relative bg-white border-2 border-black p-5 flex-grow flex flex-col justify-center" style={{ boxShadow: '8px 8px 0 0 #000' }}>
                                        <EditZone html={info.body} onChange={h => sis({ body: h })} label="CORPS" stickerPos="-top-5 right-0"
                                            className="pd text-[20px] font-bold leading-tight text-black mb-3" />
                                        <EditZone html={info.bodyMono} onChange={h => sis({ bodyMono: h })} label="CORPS 2" stickerPos="-top-5 left-0"
                                            className="sm text-[11px] leading-relaxed text-gray-700 text-justify border-l-4 pl-3" style={{ borderColor: info.accent }} />
                                    </div>
                                    {/* Action block (jagged edge) */}
                                    <div className="relative">
                                        <div className="absolute -top-4 -right-2 px-2 py-1 sm text-[9px] font-bold uppercase z-20 border-2 border-white bg-black text-white" style={{ transform: 'rotate(2deg)' }}>Warning</div>
                                        <div className="p-5 border-4 border-black relative" style={{
                                            backgroundColor: info.accent,
                                            boxShadow: '4px 4px 0 0 #000',
                                            clipPath: 'polygon(0% 0%,100% 0%,100% 100%,95% 93%,90% 100%,85% 93%,80% 100%,75% 93%,70% 100%,65% 93%,60% 100%,55% 93%,50% 100%,45% 93%,40% 100%,35% 93%,30% 100%,25% 93%,20% 100%,15% 93%,10% 100%,5% 93%,0% 100%)'
                                        }}>
                                            <h2 className="ab text-[28px] uppercase leading-none text-white mb-1" style={{ mixBlendMode: 'hard-light' as any }}>{info.actionTitle}</h2>
                                            <p className="sm text-[10px] font-bold uppercase text-black tracking-wider">{info.actionMeta}</p>
                                        </div>
                                    </div>
                                </main>
                                {/* Footer */}
                                <footer className="relative z-20 bg-black text-white px-5 py-3 flex justify-between items-center mt-auto border-t-4 shrink-0" style={{ borderColor: info.accent }}>
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: info.accent }}></div>
                                        <span className="ab text-[18px] uppercase tracking-widest">{info.brand}</span>
                                    </div>
                                    <span className="sm text-[10px]">{info.footerHandle}</span>
                                </footer>
                            </div>
                        </div>
                    )}
                    {/* ════ ANALYSIS SLIDE ════ */}
                    {template === 'ANALYSIS' && (
                        <div style={{ boxShadow: '0 0 50px rgba(0,0,0,.7)' }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] bg-[#0F0F0F] overflow-hidden border-2 border-white/10 flex flex-col group">
                                <div className="absolute inset-0 z-0">
                                    <img alt="Background Textures" className="w-full h-full object-cover opacity-30" style={{ filter: 'grayscale(1) contrast(1.25)' }} src={analysis.imageUrl} crossOrigin="anonymous" />
                                    <div className="noise-overlay" style={{ opacity: 0.2, mixBlendMode: 'overlay' }}></div>
                                </div>
                                <header className="relative z-30 w-full bg-[#DC2626] border-b-4 border-black px-4 py-3 flex justify-between items-center shrink-0">
                                    <div className="flex items-center gap-2">
                                        <EditZone html={analysis.headline} onChange={h => sda({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                                            className="ab text-white text-xl tracking-tighter uppercase leading-none" />
                                    </div>
                                    <div className="bg-black text-white px-2 py-1 font-mono text-[10px] uppercase tracking-tighter">
                                        <EditZone html={analysis.refCode} onChange={h => sda({ refCode: h })} label="REF" stickerPos="bottom-0 right-0" />
                                    </div>
                                </header>
                                <main className="relative z-20 flex-grow p-6 flex flex-col justify-between gap-4">
                                    {/* Item 1 */}
                                    <div className="relative bg-white p-4 border-2 border-black" style={{ boxShadow: '10px 10px 0px 0px rgba(0,0,0,1)' }}>
                                        <div className="flex items-start gap-4">
                                            <span className="ab text-[#DC2626] text-4xl leading-none">{analysis.item1Num}</span>
                                            <div className="flex-1 w-full min-w-0">
                                                <EditZone html={analysis.item1Title} onChange={h => sda({ item1Title: h })} label="TITRE 1" stickerPos="-top-4 left-0"
                                                    className="ab text-black text-lg uppercase leading-none mb-1 break-words whitespace-normal" />
                                                <EditZone html={analysis.item1Text} onChange={h => sda({ item1Text: h })} label="TEXTE 1" stickerPos="top-0 right-0"
                                                    className="ir text-black text-xs font-semibold leading-tight break-words whitespace-normal" />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Item 2 */}
                                    <div className="relative bg-white p-4 border-2 border-black" style={{ boxShadow: '10px 10px 0px 0px rgba(0,0,0,1)' }}>
                                        <div className="flex items-start gap-4">
                                            <span className="ab text-[#DC2626] text-4xl leading-none">{analysis.item2Num}</span>
                                            <div className="flex-1 w-full min-w-0">
                                                <EditZone html={analysis.item2Title} onChange={h => sda({ item2Title: h })} label="TITRE 2" stickerPos="-top-4 left-0"
                                                    className="ab text-black text-lg uppercase leading-none mb-1 break-words whitespace-normal" />
                                                <EditZone html={analysis.item2Text} onChange={h => sda({ item2Text: h })} label="TEXTE 2" stickerPos="top-0 right-0"
                                                    className="ir text-black text-xs font-semibold leading-tight break-words whitespace-normal" />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Item 3 */}
                                    <div className="relative bg-white p-4 border-2 border-black" style={{ boxShadow: '10px 10px 0px 0px rgba(0,0,0,1)' }}>
                                        <div className="flex items-start gap-4">
                                            <span className="ab text-[#DC2626] text-4xl leading-none">{analysis.item3Num}</span>
                                            <div className="flex-1 w-full min-w-0">
                                                <EditZone html={analysis.item3Title} onChange={h => sda({ item3Title: h })} label="TITRE 3" stickerPos="-top-4 left-0"
                                                    className="ab text-black text-lg uppercase leading-none mb-1 break-words whitespace-normal" />
                                                <EditZone html={analysis.item3Text} onChange={h => sda({ item3Text: h })} label="TEXTE 3" stickerPos="top-0 right-0"
                                                    className="ir text-black text-xs font-semibold leading-tight break-words whitespace-normal" />
                                            </div>
                                        </div>
                                    </div>
                                </main>
                                <footer className="relative z-30 flex items-center justify-between px-6 pb-6 pt-2 shrink-0">
                                    <div className="h-1 flex-grow bg-white/20 mr-4 flex">
                                        <div className="w-2/5 h-full" style={{ backgroundColor: '#DC2626' }}></div>
                                    </div>
                                    <span className="font-mono text-white text-[10px] tracking-widest uppercase shrink-0">Slide {analysis.slideNum} / {analysis.totalSlides}</span>
                                </footer>
                                <div className="absolute top-20 right-4 z-10 opacity-20 select-none pointer-events-none">
                                    <div className="ab text-white text-9xl leading-none">RAW</div>
                                </div>
                                <div className="absolute bottom-4 left-4 z-10 font-mono text-[8px] text-white/40 uppercase tracking-widest" style={{ writingMode: 'vertical-rl' }}>
                                    LASSEZ_CORE_TEMPLATE_AUTO_GEN
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════ OUTRO SLIDE ════ */}
                    {template === 'OUTRO' && (
                        <div style={{ boxShadow: '0 0 50px rgba(0,0,0,.7)' }}>
                            <div ref={exportRef} className="relative w-[560px] h-[700px] overflow-hidden flex flex-col group border-4 border-black" style={{ backgroundColor: outro.accent }}>
                                {/* bg decorations */}
                                <div className="absolute top-0 left-0 w-24 h-24 bg-black z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                                <div className="absolute top-0 left-0 w-32 h-32 border-r-4 border-b-4 border-black z-0"></div>
                                <div className="absolute bottom-0 right-0 w-32 h-32 bg-black z-10" style={{ clipPath: 'polygon(100% 100%, 0 100%, 100% 0)' }}></div>

                                <div className="flex-1 flex flex-col justify-center items-center relative z-20 p-8">
                                    <div className="absolute top-8 right-8">
                                        <span className="bg-black text-white px-4 py-1 sg text-sm font-bold uppercase tracking-widest border border-white transform -rotate-2 inline-block shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                                            Rejoignez la lutte
                                        </span>
                                    </div>
                                    <div className="relative w-full text-center my-auto transform rotate-[-5deg]">
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[120%] border-4 border-black opacity-20 pointer-events-none"></div>
                                        <EditZone html={outro.headline} onChange={h => sdo({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                                            className="pd font-black text-[5.8vw] leading-[0.9] text-black w-full" style={{ mixBlendMode: 'multiply' as any, fontSize: 'clamp(3rem, 15vw, 6rem)' }} />
                                    </div>
                                    <div className="w-full max-w-[400px] mt-8 space-y-4">
                                        <div className="bg-white border-2 border-black p-3 flex items-center justify-between transform rotate-1 transition-transform duration-300" style={{ boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)' }}>
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                                                </div>
                                                <span className="sg font-bold text-lg text-black">{outro.brandHandle}</span>
                                            </div>
                                            <span className="text-black text-xl leading-none">→</span>
                                        </div>
                                        <div className="bg-black p-4 text-center transform -rotate-1 transition-transform duration-300 border-2 border-white">
                                            <p className="sg font-black text-xl uppercase tracking-wider text-white flex items-center justify-center gap-2">
                                                <span className="text-sm">🔗</span>
                                                {outro.linkText}
                                                <span className="text-sm">🔗</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="absolute bottom-8 left-8 flex flex-col gap-1 z-20">
                                    <div className="w-16 h-1 bg-black"></div>
                                    <div className="w-12 h-1 bg-black"></div>
                                    <div className="w-20 h-1 bg-black"></div>
                                    <div className="w-8 h-1 bg-black"></div>
                                    <span className="text-[10px] font-mono font-bold mt-1 text-black">{outro.footerYear}</span>
                                </div>
                                <div className="absolute -bottom-16 -left-4 ir font-black text-[10rem] opacity-10 pointer-events-none select-none text-black">
                                    {outro.number}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ════ COMPARISON CHART ════ */}
                    {template === 'COMPARISON_CHART' && (() => {
                        const maxVal = Math.max(...chart.bars.map(b => b.value), 1);
                        const LABEL_H = 56; // fixed label zone height in px
                        return (
                            <div style={{ boxShadow: `8px 8px 0 ${chart.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-[#F4F4F4] overflow-hidden border-4 border-black flex flex-col">
                                    {/* Noise */}
                                    <div className="noise-overlay" style={{ opacity: 0.05, zIndex: 5 }}></div>
                                    {/* Header */}
                                    <div className="bg-black text-white px-6 pt-5 pb-4 border-b-4 border-black shrink-0 z-10">
                                        <div className="inline-block px-3 py-0.5 sm text-[10px] font-bold uppercase tracking-widest mb-2 border border-white/30" style={{ background: chart.accent }}>
                                            <EditZone html={chart.category} onChange={h => scc({ category: h })} label="CAT" stickerPos="top-0 right-0" className="sm text-[10px] font-bold uppercase text-white" />
                                        </div>
                                        <EditZone html={chart.headline} onChange={h => scc({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                            className="ab block text-white uppercase leading-[0.92] tracking-tight mb-1" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.2rem)' }} />
                                        <EditZone html={chart.subheadline} onChange={h => scc({ subheadline: h })} label="SOUS-TITRE" stickerPos="-top-5 left-0"
                                            className="sm block text-white/70 uppercase font-bold tracking-wide" style={{ fontSize: '0.65rem' }} />
                                    </div>
                                    {/* Chart area */}
                                    <div className="flex-1 px-8 pt-5 pb-0 flex flex-col">
                                        <div className="relative flex-1 border-l-4 border-b-4 border-black">
                                            {/* Grid lines */}
                                            {[25, 50, 75, 100].map(pct => (
                                                <div key={pct} className="absolute w-full border-t border-black/10" style={{ bottom: `${pct}%` }}>
                                                    <span className="sm absolute right-[calc(100%+4px)] text-[8px] text-gray-400 bottom-0 leading-none">{Math.round(maxVal * pct / 100)}</span>
                                                </div>
                                            ))}
                                            {/* Bars */}
                                            <div className="absolute inset-0 flex items-end justify-around gap-3 px-3">
                                                {chart.bars.map((bar, i) => {
                                                    const pct = maxVal === 0 ? 2 : Math.max((bar.value / maxVal) * 100, 2);
                                                    const isSmall = pct < 20; // show value above bar if tiny
                                                    const isMax = bar.value === Math.max(...chart.bars.map(b => b.value));
                                                    return (
                                                        <div key={i} className="flex flex-col items-center justify-end flex-1 h-full">
                                                            {/* Value above if small */}
                                                            {isSmall && (
                                                                <span className="ab font-black text-black" style={{ fontSize: '1.2rem', lineHeight: 1 }}>{bar.value}</span>
                                                            )}
                                                            <div className="w-full relative flex items-start justify-center pt-1 border-2 border-black"
                                                                style={{ height: `${pct}%`, backgroundColor: bar.color, boxShadow: isMax ? `3px -3px 0 ${chart.accent}` : 'none', minHeight: '6px' }}>
                                                                {!isSmall && (
                                                                    <span className="ab font-black text-white" style={{ fontSize: pct > 35 ? '1.8rem' : '0.9rem' }}>{bar.value}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        
                                        {/* Dynamic labels zone (inside flex-1) */}
                                        <div className="flex justify-around gap-3 pt-2 pb-4">
                                            {chart.bars.map((bar, i) => (
                                                <div key={i} className="flex-1 text-center px-1">
                                                    <div className="w-full h-1 mb-1.5" style={{ backgroundColor: bar.color }}></div>
                                                    <span className="sm block font-black uppercase leading-[1.1] text-black" style={{ fontSize: '0.62rem', wordBreak: 'break-word', hyphens: 'auto' }}>{bar.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Source Footer */}
                                    <div className="bg-black text-white px-5 py-3 border-t-4 border-black shrink-0 z-10 flex justify-between items-center">
                                        <EditZone html={chart.source} onChange={h => scc({ source: h })} label="SOURCE" stickerPos="top-0 right-0"
                                            className="sm text-white/70 leading-tight" style={{ fontSize: '0.62rem' }} />
                                        <div className="shrink-0 ml-3 px-2 py-1 border-2 border-white">
                                            <span className="ab font-bold text-white text-xs uppercase">{chart.brand}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ STACKED DATA ════ */}
                    {template === 'STACKED_DATA' && (() => {
                        // For each row, total = sum of all cells. Each cell width = proportional to value / rowTotal
                        return (
                            <div style={{ boxShadow: `6px 6px 0 ${stackedData.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-[#F9F9F9] overflow-hidden border-4 border-black flex flex-col">
                                    <div className="noise-overlay" style={{ opacity: 0.04, zIndex: 5 }}></div>
                                    {/* Header */}
                                    <div className="bg-black text-white px-5 pt-5 pb-3 shrink-0 z-10">
                                        <EditZone html={stackedData.headline} onChange={h => ssd({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                                            className="ab block text-white font-black uppercase leading-tight tracking-tight" style={{ fontSize: 'clamp(0.95rem, 4vw, 1.4rem)' }} />
                                    </div>
                                    <div className="bg-[#F9F9F9] px-5 py-2 border-b-4 border-black shrink-0 z-10">
                                        <EditZone html={stackedData.subheadline} onChange={h => ssd({ subheadline: h })} label="SOUS-TITRE" stickerPos="top-0 right-0"
                                            className="sm block font-bold uppercase" style={{ fontSize: '0.57rem', color: '#1A1C1C' }} />
                                    </div>
                                    {/* Stacked bar rows */}
                                    <div className="flex-1 overflow-hidden flex flex-col px-4 py-3 gap-2">
                                        {stackedData.rows.map((row, ri) => {
                                            const rowTotal = Math.max(row.cells.reduce((s, c) => s + c.value, 0), 1);
                                            return (
                                                <div key={ri} className="flex flex-col flex-1 min-h-0">
                                                    {/* Sector label */}
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="sm font-black uppercase text-black" style={{ fontSize: '0.58rem', letterSpacing: '0.1em' }}>{row.sector}</span>
                                                        <div className="flex-1 h-[2px] bg-black/15"></div>
                                                        <span className="sm font-bold text-black/50" style={{ fontSize: '0.55rem' }}>{rowTotal.toLocaleString()}</span>
                                                    </div>
                                                    {/* Stacked bar */}
                                                    <div className="flex h-full border-2 border-black overflow-hidden">
                                                        {row.cells.map((cell, ci) => {
                                                            const col = stackedData.columns[ci];
                                                            const widthPct = (cell.value / rowTotal) * 100;
                                                            if (widthPct < 0.3) return null;
                                                            return (
                                                                <div key={ci}
                                                                    className="relative flex flex-col items-center justify-center overflow-hidden border-r border-black/20 last:border-r-0 transition-all"
                                                                    style={{ width: `${widthPct}%`, backgroundColor: col?.color ?? '#888', minWidth: widthPct > 4 ? undefined : 0 }}>
                                                                    {widthPct > 9 && (
                                                                        <>
                                                                            <span className="ab font-black text-white leading-none" style={{ fontSize: widthPct > 20 ? '1.1rem' : '0.7rem', textShadow: '1px 1px 0 rgba(0,0,0,0.4)' }}>{cell.value}</span>
                                                                            {widthPct > 18 && <span className="sm text-white/70 uppercase leading-none" style={{ fontSize: '0.42rem' }}>{cell.label || col?.label}</span>}
                                                                        </>
                                                                    )}
                                                                    {widthPct <= 9 && widthPct > 4 && (
                                                                        <span className="ab font-black text-white" style={{ fontSize: '0.55rem', writingMode: 'vertical-rl', textShadow: '1px 1px 0 rgba(0,0,0,0.5)' }}>{cell.value}</span>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Legend */}
                                    <div className="border-t-4 border-black px-5 py-2 bg-[#F9F9F9] flex gap-3 flex-wrap shrink-0 z-10">
                                        {stackedData.columns.map((col, ci) => (
                                            <div key={ci} className="flex items-center gap-1">
                                                <div className="w-3 h-3 border border-black" style={{ backgroundColor: col.color }}></div>
                                                <span className="sm uppercase font-bold" style={{ fontSize: '0.48rem', color: '#1A1C1C' }}>{col.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Source footer */}
                                    <div className="bg-black text-white flex items-center justify-between px-5 py-2 shrink-0 z-10">
                                        <EditZone html={stackedData.source} onChange={h => ssd({ source: h })} label="SOURCE" stickerPos="top-0 right-0"
                                            className="sm text-white/70 uppercase flex-1" style={{ fontSize: '0.5rem' }} />
                                        <div className="ml-3 px-2 py-0.5 border-2 border-white shrink-0">
                                            <span className="ab font-bold text-white text-xs uppercase">{stackedData.brand}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ VOTE TRACKER ════ */}
                    {template === 'VOTE_TRACKER' && (() => {
                        const colorPour = voteTracker.colorPour ?? '#1A1C1C';
                        const colorContre = voteTracker.colorContre ?? '#BC0100';
                        const colorAbst = voteTracker.colorAbst ?? '#888888';
                        return (
                            <div style={{ boxShadow: `6px 6px 0 ${voteTracker.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-white overflow-hidden border-4 border-black flex flex-col"
                                    style={{ backgroundImage: 'linear-gradient(#d4d4d4 1px, transparent 1px), linear-gradient(90deg, #d4d4d4 1px, transparent 1px)', backgroundSize: '52px 52px' }}>
                                    <div className="noise-overlay" style={{ opacity: 0.04, zIndex: 5 }}></div>
                                    {/* Header block */}
                                    <div className="relative bg-white border-b-4 border-black shrink-0 overflow-hidden z-10">
                                        {/* Photo overlay */}
                                        {voteTracker.imageUrl && (
                                            <div className="absolute top-0 right-0 w-36 h-44 overflow-hidden" style={{ filter: 'grayscale(100%) contrast(1.4)' }}>
                                                <img src={voteTracker.imageUrl} alt="" className="w-full h-full object-cover object-top" crossOrigin="anonymous" />
                                                <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, transparent 30%, white 85%)' }}></div>
                                            </div>
                                        )}
                                        <div className="relative z-10 p-5 pr-32">
                                            {/* L'Assez logo — same style as other slides */}
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="w-4 h-4 bg-black flex items-center justify-center shrink-0">
                                                    <div className="w-2.5 h-0.5 bg-white"></div>
                                                </div>
                                                <span className="ab font-bold uppercase tracking-widest text-black" style={{ fontSize: '0.65rem' }}>{voteTracker.brand}</span>
                                            </div>
                                            <EditZone html={voteTracker.title} onChange={h => svt({ title: h })} label="TITRE" stickerPos="-top-4 right-0"
                                                className="ab block font-black uppercase leading-tight text-black" style={{ fontSize: 'clamp(1.4rem, 6vw, 2rem)' }} />
                                            <div className="mt-2 inline-block px-3 py-0.5 border-2 border-black" style={{ background: voteTracker.accent }}>
                                                <EditZone html={voteTracker.subtitle} onChange={h => svt({ subtitle: h })} label="SOUS-TITRE" stickerPos="top-0 right-0"
                                                    className="sm text-white font-bold uppercase" style={{ fontSize: '0.6rem' }} />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Vote rows */}
                                    <div className="flex-1 flex flex-col overflow-hidden bg-white z-10">
                                        {voteTracker.votes.map((vr, i) => {
                                            const voteColor = vr.vote === 'POUR' ? colorPour : vr.vote === 'ABST' ? colorAbst : colorContre;
                                            return (
                                                <div key={i} className="flex items-stretch border-b-2 border-black/20 flex-1">
                                                    <div className="flex-1 flex items-center px-4 py-1.5 bg-white border-r-2 border-black/20">
                                                        <span className="ir font-bold leading-tight text-black" style={{ fontSize: '0.7rem' }}>{vr.law}</span>
                                                    </div>
                                                    <div className="w-24 shrink-0 flex items-center justify-center border-l-2 border-black"
                                                        style={{ backgroundColor: voteColor }}>
                                                        <span className="ab font-black text-white tracking-tight" style={{ fontSize: 'clamp(1rem, 4.5vw, 1.5rem)' }}>{vr.vote}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {/* Footer */}
                                    <div className="shrink-0 border-t-4 border-black bg-white px-4 py-2.5 flex justify-between items-center z-10">
                                        <div className="border-2 border-black px-3 py-1">
                                            <EditZone html={voteTracker.variant} onChange={h => svt({ variant: h })} label="VARIANT" stickerPos="top-0 right-0"
                                                className="sm font-bold uppercase text-black" style={{ fontSize: '0.65rem' }} />
                                        </div>
                                        <div className="border-2 border-black px-3 py-1" style={{ background: voteTracker.accent }}>
                                            <span className="ab font-black text-white uppercase" style={{ fontSize: '0.8rem' }}>{voteTracker.brand}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ TERRITORY RADAR ════ */}
                    {template === 'TERRITORY_RADAR' && (() => {
                        return (
                            <div style={{ boxShadow: `8px 8px 0 ${territoryRadar.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-[#F4F4F4] overflow-hidden border-4 border-black flex flex-col">
                                    <div className="noise-overlay" style={{ opacity: 0.04, zIndex: 5 }}></div>
                                    {/* Header */}
                                    <div className="bg-black text-white px-6 pt-5 pb-4 shrink-0 z-10 border-b-4 border-black">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div className="w-2 h-0.5 bg-black"></div></div>
                                            <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{territoryRadar.brand}</span>
                                            <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase" style={{ background: territoryRadar.accent }}>TERRITOIRE</div>
                                        </div>
                                        <EditZone html={territoryRadar.headline} onChange={h => str({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                                            className="ab block text-white uppercase leading-[0.9] tracking-tight" style={{ fontSize: 'clamp(1.4rem,5vw,2rem)' }} />
                                        <EditZone html={territoryRadar.subheadline} onChange={h => str({ subheadline: h })} label="SOUS-TITRE" stickerPos="-top-4 left-0"
                                            className="sm block text-white/60 uppercase font-bold mt-1" style={{ fontSize: '0.6rem' }} />
                                    </div>
                                    {/* Map zone */}
                                    <div className="flex flex-1 gap-0 overflow-hidden">
                                        {/* Left: SVG map placeholder or custom SVG */}
                                        <div className="flex-1 relative bg-black/5 border-r-4 border-black overflow-hidden">
                                            {territoryRadar.svgContent ? (
                                                <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: territoryRadar.svgContent }} />
                                            ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                                    <svg viewBox="0 0 200 280" className="w-48 h-64 opacity-80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M60 10 L80 8 L110 20 L140 15 L155 40 L165 60 L150 80 L155 100 L140 120 L145 145 L130 165 L120 190 L100 220 L85 240 L70 230 L55 210 L45 185 L30 160 L20 135 L35 110 L25 80 L40 55 L50 35 Z" fill={territoryRadar.legend[2]?.color ?? '#555'} />
                                                        <path d="M60 10 L80 8 L110 20 L140 15 L150 30 L120 45 L100 40 L80 50 L65 35 Z" fill={territoryRadar.legend[0]?.color ?? '#BC0100'} />
                                                        <path d="M100 100 L130 95 L140 120 L130 145 L110 150 L95 135 L90 115 Z" fill={territoryRadar.legend[1]?.color ?? '#1A1C1C'} />
                                                        <path d="M40 140 L65 135 L75 155 L70 175 L50 180 L35 165 L30 145 Z" fill={territoryRadar.legend[2]?.color ?? '#555'} />
                                                        <path d="M80 180 L105 175 L115 195 L105 220 L85 225 L70 210 Z" fill={territoryRadar.legend[3]?.color ?? '#888'} />
                                                    </svg>
                                                    <span className="sm text-[9px] text-black/30 uppercase font-bold">Coller un SVG dans svgContent</span>
                                                </div>
                                            )}
                                            {/* Legend overlay */}
                                            <div className="absolute bottom-0 left-0 right-0 bg-white/90 border-t-2 border-black p-3 space-y-1.5">
                                                {territoryRadar.legend.map((l, i) => (
                                                    <div key={i} className="flex items-center gap-2">
                                                        <div className="w-3 h-3 border border-black shrink-0" style={{ backgroundColor: l.color }}></div>
                                                        <span className="sm font-bold uppercase" style={{ fontSize: '0.58rem' }}>{l.label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        {/* Right: Stats */}
                                        <div className="w-36 shrink-0 flex flex-col bg-black">
                                            {territoryRadar.stats.map((s, i) => (
                                                <div key={i} className="flex-1 flex flex-col items-center justify-center border-b border-white/10 p-3 text-center">
                                                    <span className="ab font-black text-white" style={{ fontSize: '1.6rem', lineHeight: 1 }}>{s.value}</span>
                                                    <span className="sm font-bold text-white/50 uppercase mt-1" style={{ fontSize: '0.52rem' }}>{s.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Footer */}
                                    <div className="bg-black text-white px-5 py-2.5 border-t-4 border-black shrink-0 z-10 flex justify-between items-center">
                                        <span className="sm text-white/50 uppercase" style={{ fontSize: '0.55rem' }}>{territoryRadar.source}</span>
                                        <div className="shrink-0 px-2 py-0.5 border-2 border-white"><span className="ab font-bold text-white text-[10px] uppercase">{territoryRadar.brand}</span></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ DECODING ════ */}
                    {template === 'DECODING' && (() => {
                        return (
                            <div style={{ boxShadow: `10px 10px 0 ${decoding.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-white overflow-hidden border-4 border-black flex flex-col">
                                    <div className="noise-overlay" style={{ opacity: 0.04, zIndex: 5 }}></div>
                                    {/* Header bar */}
                                    <div className="bg-black px-7 pt-6 pb-4 shrink-0 border-b-4 border-black">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-3.5 h-3.5 bg-white flex items-center justify-center"><div className="w-2 h-0.5 bg-black"></div></div>
                                            <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{decoding.brand}</span>
                                            <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: '#fff' }}>LE MÉCANICIEN</div>
                                        </div>
                                        <EditZone html={decoding.headline} onChange={h => sdec({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                                            className="ab block text-white uppercase leading-tight" style={{ fontSize: '1.5rem' }} />
                                    </div>
                                    {/* Jargon term — BIG and STRUCK */}
                                    <div className="bg-white px-7 py-6 border-b-4 border-black shrink-0 flex items-center gap-5">
                                        <div className="relative">
                                            <span className="ab font-black uppercase text-black" style={{ fontSize: 'clamp(2.5rem,10vw,4rem)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                                                {decoding.jargonTerm}
                                            </span>
                                            {/* Red strike-through */}
                                            <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 pointer-events-none" style={{ backgroundColor: decoding.accent, transform: 'translateY(-50%) rotate(-2deg)' }}></div>
                                        </div>
                                        <div className="ml-auto shrink-0 w-12 h-12 flex items-center justify-center border-4 border-black">
                                            <span className="ab font-black text-2xl" style={{ color: decoding.accent }}>✕</span>
                                        </div>
                                    </div>
                                    {/* Two-column decode */}
                                    <div className="flex flex-1 overflow-hidden">
                                        {/* Official version */}
                                        <div className="w-1/2 border-r-4 border-black p-6 flex flex-col bg-white">
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 bg-black flex items-center justify-center shrink-0">
                                                    <span className="text-white sm font-bold" style={{ fontSize: '0.55rem' }}>OFF</span>
                                                </div>
                                                <span className="sm font-black uppercase text-black" style={{ fontSize: '0.62rem', letterSpacing: '0.15em' }}>VERSION OFFICIELLE</span>
                                            </div>
                                            <div className="flex-1 border-l-4 pl-4 py-2" style={{ borderColor: '#888' }}>
                                                <EditZone html={decoding.officialDef} onChange={h => sdec({ officialDef: h })} label="VERSION OFF." stickerPos="-top-5 right-0"
                                                    className="ir text-black leading-relaxed italic" style={{ fontSize: '0.9rem' }} />
                                            </div>
                                        </div>
                                        {/* Reality check */}
                                        <div className="w-1/2 p-6 flex flex-col" style={{ backgroundColor: decoding.accent }}>
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="w-5 h-5 bg-black flex items-center justify-center shrink-0">
                                                    <span className="text-white sm font-bold" style={{ fontSize: '0.55rem' }}>▲</span>
                                                </div>
                                                <span className="sm font-black uppercase text-black" style={{ fontSize: '0.62rem', letterSpacing: '0.15em' }}>LA RÉALITÉ</span>
                                            </div>
                                            <div className="flex-1 border-l-4 border-black pl-4 py-2">
                                                <EditZone html={decoding.realityCheck} onChange={h => sdec({ realityCheck: h })} label="RÉALITÉ" stickerPos="-top-5 right-0"
                                                    className="sm font-bold text-black leading-relaxed" style={{ fontSize: '0.88rem' }} />
                                            </div>
                                        </div>
                                    </div>
                                    {/* Footer */}
                                    <div className="bg-black px-6 py-3 border-t-4 border-black shrink-0 flex items-center justify-between">
                                        <span className="ab font-black text-white uppercase" style={{ fontSize: '0.65rem' }}>{decoding.brand} / DÉCODAGE POLITIQUE</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ CHRONO LOCK ════ */}
                    {template === 'CHRONO_LOCK' && (() => {
                        return (
                            <div style={{ boxShadow: `8px 8px 0 ${chronoLock.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-white overflow-hidden border-4 border-black flex flex-col">
                                    <div className="noise-overlay" style={{ opacity: 0.04, zIndex: 5 }}></div>
                                    {/* Header */}
                                    <div className="bg-black px-7 pt-6 pb-5 shrink-0 border-b-4 border-black">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-3.5 h-3.5 bg-white flex items-center justify-center"><div className="w-2 h-0.5 bg-black"></div></div>
                                            <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{chronoLock.brand}</span>
                                            <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: chronoLock.accent }}>⏱ CHRONOLOGIE</div>
                                        </div>
                                        <EditZone html={chronoLock.headline} onChange={h => scl({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                                            className="ab block text-white uppercase leading-[0.9]" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)' }} />
                                        <EditZone html={chronoLock.subheadline} onChange={h => scl({ subheadline: h })} label="SOUS-TITRE" stickerPos="-top-4 left-0"
                                            className="sm block text-white/60 uppercase font-bold mt-1" style={{ fontSize: '0.6rem' }} />
                                    </div>
                                    {/* Timeline */}
                                    <div className="flex-1 px-8 py-6 overflow-hidden flex flex-col justify-between">
                                        {chronoLock.timeline.map((ev, i) => (
                                            <div key={i} className="flex gap-5 relative">
                                                {/* Line + dot */}
                                                <div className="flex flex-col items-center shrink-0 w-6">
                                                    <div className="w-4 h-4 border-4 border-black bg-white shrink-0 z-10" style={{ borderColor: i === 0 ? chronoLock.accent : '#000' }}></div>
                                                    {i < chronoLock.timeline.length - 1 && (
                                                        <div className="flex-1 w-[3px] bg-black mt-0.5" style={{ minHeight: '32px' }}></div>
                                                    )}
                                                </div>
                                                {/* Content */}
                                                <div className="flex-1 pb-6">
                                                    <div className="inline-block px-2 py-0.5 sm font-black uppercase text-white mb-1.5" style={{ backgroundColor: i === 0 ? chronoLock.accent : '#1A1C1C', fontSize: '0.6rem', letterSpacing: '0.12em' }}>{ev.date}</div>
                                                    <p className="ab font-black uppercase text-black leading-tight mb-1" style={{ fontSize: '1rem' }}>{ev.event}</p>
                                                    <p className="sm text-black/60 font-bold uppercase" style={{ fontSize: '0.62rem' }}>{ev.impact}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    {/* Footer */}
                                    <div className="bg-black text-white px-6 py-3 border-t-4 border-black shrink-0 flex items-center justify-between">
                                        <span className="ab font-black uppercase text-white tracking-wide" style={{ fontSize: '0.65rem' }}>{chronoLock.brand} / RIEN N'EST UN HASARD</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ IMPACT QUOTE ════ */}
                    {template === 'IMPACT_QUOTE' && (() => {
                        return (
                            <div style={{ boxShadow: `10px 10px 0 ${impactQuote.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-black overflow-hidden border-4 border-black flex flex-col">
                                    <div className="noise-overlay" style={{ opacity: 0.08, zIndex: 5 }}></div>
                                    {/* Brand strip top */}
                                    <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b-2 shrink-0 z-10" style={{ borderColor: impactQuote.accent + '50' }}>
                                        <div className="w-3.5 h-3.5 bg-white flex items-center justify-center"><div className="w-2 h-0.5 bg-black"></div></div>
                                        <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{impactQuote.brand}</span>
                                        <div className="ml-auto w-5 h-5 border-2 flex items-center justify-center" style={{ borderColor: impactQuote.accent }}>
                                            <span className="sm font-black" style={{ fontSize: '0.5rem', color: impactQuote.accent }}>"</span>
                                        </div>
                                    </div>
                                    {/* GIANT QUOTE — 80% of slide */}
                                    <div className="flex-1 flex flex-col items-center justify-center px-7 py-4 z-10">
                                        {/* Opening mark */}
                                        <div className="self-start ab font-black leading-none mb-2" style={{ fontSize: '5rem', lineHeight: 0.6, color: impactQuote.accent, opacity: 0.8 }}>"</div>
                                        <EditZone html={impactQuote.largeQuote} onChange={h => siq({ largeQuote: h })} label="CITATION" stickerPos="-top-5 right-0"
                                            className="ir font-bold text-white leading-tight text-center" style={{ fontSize: 'clamp(1.2rem, 4.5vw, 2rem)' }} />
                                        {/* Closing mark */}
                                        <div className="self-end ab font-black leading-none mt-2" style={{ fontSize: '5rem', lineHeight: 0.6, color: impactQuote.accent, opacity: 0.8 }}>"</div>
                                    </div>
                                    {/* Author + context strip */}
                                    <div className="border-t-4 px-7 py-5 shrink-0 z-10" style={{ backgroundColor: impactQuote.accent, borderColor: '#000' }}>
                                        <span className="ab font-black text-black uppercase block leading-tight" style={{ fontSize: '1.1rem' }}>— {impactQuote.author}</span>
                                        <span className="sm font-bold text-black/70 uppercase mt-1 block" style={{ fontSize: '0.6rem' }}>{impactQuote.context}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ SOCIAL COST ════ */}
                    {template === 'SOCIAL_COST' && (() => {
                        return (
                            <div style={{ boxShadow: `8px 8px 0 ${socialCost.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-white overflow-hidden border-4 border-black flex flex-col">
                                    <div className="noise-overlay" style={{ opacity: 0.04, zIndex: 5 }}></div>
                                    {/* Header */}
                                    <div className="bg-black px-7 pt-6 pb-5 shrink-0 border-b-4 border-black">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-3.5 h-3.5 bg-white flex items-center justify-center"><div className="w-2 h-0.5 bg-black"></div></div>
                                            <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{socialCost.brand}</span>
                                            <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: socialCost.accent }}>CALCULETTE</div>
                                        </div>
                                        <EditZone html={socialCost.headline} onChange={h => ssc({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                                            className="ab block text-white uppercase leading-tight" style={{ fontSize: '1.5rem' }} />
                                    </div>
                                    {/* Audience badge */}
                                    <div className="px-7 py-4 border-b-4 border-black bg-[#F4F4F4] flex items-center gap-4 shrink-0">
                                        <div className="px-4 py-2 border-4 border-black bg-black">
                                            <span className="ab font-black uppercase text-white" style={{ fontSize: '0.8rem' }}>{socialCost.targetAudience}</span>
                                        </div>
                                        <div className="h-px flex-1 bg-black"></div>
                                        <span className="ab font-black uppercase text-black/30" style={{ fontSize: '0.7rem' }}>COMBIEN ÇA COÛTE ?</span>
                                    </div>
                                    {/* Big numbers */}
                                    <div className="flex flex-1 overflow-hidden">
                                        <div className="w-1/2 border-r-4 border-black p-8 flex flex-col items-center justify-center bg-white">
                                            <span className="sm font-black uppercase text-black/40 mb-1 tracking-widest" style={{ fontSize: '0.62rem' }}>PAR MOIS</span>
                                            <span className="ab font-black leading-none" style={{ fontSize: 'clamp(3.5rem,14vw,5.5rem)', color: socialCost.accent }}>{socialCost.monthlyLoss}</span>
                                        </div>
                                        <div className="w-1/2 p-8 flex flex-col items-center justify-center bg-black">
                                            <span className="sm font-black uppercase text-white/40 mb-1 tracking-widest" style={{ fontSize: '0.62rem' }}>PAR AN</span>
                                            <span className="ab font-black leading-none" style={{ fontSize: 'clamp(3rem,12vw,4.5rem)', color: socialCost.accent }}>{socialCost.annualImpact}</span>
                                        </div>
                                    </div>
                                    {/* Consequence block */}
                                    <div className="px-7 py-5 border-t-4 border-black bg-[#F4F4F4] shrink-0">
                                        <EditZone html={socialCost.consequence} onChange={h => ssc({ consequence: h })} label="CONSÉQUENCE" stickerPos="-top-5 right-0"
                                            className="sm font-bold text-black leading-relaxed" style={{ fontSize: '0.8rem' }} />
                                        <div className="mt-3 pt-2 border-t border-black/20">
                                            <span className="sm text-black/40 font-bold uppercase" style={{ fontSize: '0.55rem' }}>{socialCost.note}</span>
                                        </div>
                                    </div>
                                    {/* Footer */}
                                    <div className="bg-black px-6 py-2.5 border-t-4 border-black shrink-0 flex items-center justify-between">
                                        <span className="ab font-black text-white uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>{socialCost.brand}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ════ VIDEO NOTE ════ */}
                    {template === 'VIDEO_NOTE' && (() => {
                        const isYoutube = videoNote.videoUrl.includes('youtube') || videoNote.videoUrl.includes('youtu.be');
                        const getYoutubeId = (url: string) => { const m = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/); return m?.[1] ?? ''; };
                        const ytId = isYoutube ? getYoutubeId(videoNote.videoUrl) : '';
                        const isMp4 = videoNote.videoUrl && !isYoutube;
                        return (
                            <div style={{ boxShadow: `8px 8px 0 ${videoNote.accent}` }}>
                                <div ref={exportRef} className="relative w-[560px] h-[700px] bg-black overflow-hidden border-4 border-black flex flex-col">
                                    <div className="noise-overlay" style={{ opacity: 0.05, zIndex: 5 }}></div>
                                    {/* Header */}
                                    <div className="px-6 pt-5 pb-4 border-b-4 border-white/10 shrink-0 z-10 flex items-center gap-3">
                                        <div className="w-3.5 h-3.5 bg-white flex items-center justify-center"><div className="w-2 h-0.5 bg-black"></div></div>
                                        <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{videoNote.brand}</span>
                                        <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: videoNote.accent }}>🎬 DOCUMENT VIDÉO</div>
                                    </div>
                                    {/* Headline */}
                                    <div className="px-6 py-4 shrink-0 border-b-4 border-white/10 z-10">
                                        <EditZone html={videoNote.headline} onChange={h => svn({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                                            className="ab block text-white uppercase leading-tight" style={{ fontSize: '1.6rem' }} />
                                    </div>
                                    {/* === LIVE VIDEO ZONE (preview only — hidden on export) === */}
                                    <div data-export="live" style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden', zIndex: 10 }}>
                                        {isYoutube && ytId ? (
                                            <iframe
                                                className="absolute inset-0 w-full h-full"
                                                src={`https://www.youtube.com/embed/${ytId}`}
                                                allow="autoplay; encrypted-media"
                                                title="video"
                                            />
                                        ) : videoNote.videoUrl ? (
                                            <DraggableVideo 
                                                src={videoNote.videoUrl} 
                                                zoom={videoNote.videoZoom || 1} 
                                                posX={videoNote.videoX || 0} 
                                                posY={videoNote.videoY || 0} 
                                                onPosChange={(x, y) => svn({ videoX: x, videoY: y })} 
                                            />
                                        ) : (
                                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/20">
                                                <span className="text-6xl opacity-50">▶</span>
                                                <span className="sm text-white/30 uppercase text-[10px] font-bold">Collez une URL vidéo dans la sidebar</span>
                                                <span className="sm text-white/20 uppercase text-[8px]">MP4 direct · YouTube</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* === STATIC EXPORT ZONE — 100% inline styles, visible uniquement pendant export PNG === */}
                                    <div data-export="static" style={{
                                        display: 'none', flex: 1, flexDirection: 'column' as const,
                                        alignItems: 'center', justifyContent: 'center',
                                        gap: 16, padding: 32, background: '#000', position: 'relative' as const, zIndex: 10
                                    }}>
                                        <div style={{ width: 80, height: 80, border: `4px solid ${videoNote.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ color: '#fff', fontSize: '2.5rem', lineHeight: 1 }}>▶</span>
                                        </div>
                                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.62rem', textAlign: 'center' as const, fontFamily: 'Arial,sans-serif', fontWeight: 700, textTransform: 'uppercase' as const, wordBreak: 'break-all' as const, maxWidth: '100%', margin: '8px 0 0' }}>
                                            {videoNote.videoUrl || 'URL VIDÉO NON DÉFINIE'}
                                        </p>
                                        {isMp4 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `2px solid ${videoNote.accent}`, padding: '4px 12px', marginTop: 8 }}>
                                                <span style={{ color: videoNote.accent, fontSize: '0.75rem' }}>↓</span>
                                                <span style={{ color: '#fff', fontSize: '0.6rem', fontFamily: 'Arial,sans-serif', fontWeight: 700, textTransform: 'uppercase' as const }}>FICHIER MP4 TÉLÉCHARGEABLE</span>
                                            </div>
                                        )}
                                        {isYoutube && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px solid #FF0000', padding: '4px 12px', marginTop: 8 }}>
                                                <span style={{ color: '#fff', fontSize: '0.6rem', fontFamily: 'Arial,sans-serif', fontWeight: 700, textTransform: 'uppercase' as const }}>▶ YOUTUBE — VOIR EN LIGNE</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Annotation block */}
                                    <div className="border-t-4 px-6 py-5 shrink-0 z-10" style={{ borderColor: videoNote.accent, backgroundColor: '#0f0f0f' }}>
                                        <div className="flex gap-3 items-start">
                                            <div className="w-5 h-5 shrink-0 flex items-center justify-center border-2" style={{ borderColor: videoNote.accent }}>
                                                <span className="sm font-black" style={{ fontSize: '0.55rem', color: videoNote.accent }}>!</span>
                                            </div>
                                            <EditZone html={videoNote.annotation} onChange={h => svn({ annotation: h })} label="ANNOTATION" stickerPos="-top-5 right-0"
                                                className="ir font-bold text-white leading-relaxed flex-1" style={{ fontSize: '0.88rem' }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                </main>
            </div>

            <footer className="h-7 border-t border-white/10 bg-black flex items-center justify-between px-5 sm text-[9px] text-gray-600 uppercase shrink-0">
                <div className="flex gap-5"><span>EDITOR v2.4</span><span style={{ color: curAccent }}>20 TEMPLATES — CHARTS — TIMELINE — QUOTE — VIDEO NOTE</span></div>
                <span className="opacity-40">Select text → industrial toolbar | Drag image → reposition</span>
            </footer>

            {exportProgress && (
                <div className="fixed inset-0 z-[10000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
                    <div className="w-24 h-24 border-8 border-t-white/10 animate-spin rounded-full mb-8" style={{ borderColor: `${curAccent} white white ${curAccent}` }}></div>
                    <div className="ab text-5xl text-white uppercase tracking-tighter mb-4">{exportProgress}</div>
                    <div className="sm text-[10px] text-white/40 uppercase tracking-[0.4em] max-w-[300px] leading-relaxed">
                        Traitement lourd en cours directement dans votre navigateur · Ne fermez pas cet onglet
                    </div>
                </div>
            )}
        </div>
    );
}
