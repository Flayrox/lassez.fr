'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

import { StudioProvider, useStudio } from './components/StudioContext';
import { StudioSidebar } from './components/StudioSidebar';
import { StudioPropertiesPanel } from './components/StudioPropertiesPanel';
import { StudioCanvas } from './components/StudioCanvas';
import { StudioToolbar } from './components/StudioToolbar';
import { StudioExportBar } from './components/StudioExportBar';
import { StudioModals } from './components/StudioModals';
import { useFFmpeg } from './hooks/useFFmpeg';
import { useStudioExport } from './hooks/useStudioExport';
import { useStudioAI } from './hooks/useStudioAI';
import { CSS, DN } from './components/constants';

/**
 * STUDIO v4.0 — INDÉPENDANT & AUTONOME
 * Page complètement détachée du Radar admin
 */
export default function StudioPage() {
    return (
        <React.Suspense fallback={<div className="h-screen bg-black" />}>
            <StudioProvider>
                <StudioPageContent />
            </StudioProvider>
        </React.Suspense>
    );
}

function StudioPageContent() {
    const { deck, setDeck, setActiveId, setArticleInput, isSwapped, setIsSwapped } = useStudio();
    const searchParams = useSearchParams();
    const postId = searchParams.get('id');
    
    const exportRef = useRef<HTMLDivElement>(null);
    const [showArticleModal, setShowArticleModal] = useState(false);
    const [showJsonImport, setShowJsonImport] = useState(false);

    const { loadFFmpeg, exportProgress, setExportProgress } = useFFmpeg();
    const { handleExport, handleExportAll, handleExportJSON } = useStudioExport(exportRef, loadFFmpeg, setExportProgress, postId);
    const { aiGenerateDeck } = useStudioAI();

    // ── Resizable Layout State ────────────────
    const [sidebarWidth, setSidebarWidth] = useState(300);
    const [propertiesWidth, setPropertiesWidth] = useState(320);
    const [resizing, setResizing] = useState<'sidebar' | 'properties' | null>(null);

    // ── Resizing Logic ────────────────────────
    const handleMouseMove = (e: MouseEvent) => {
        if (!resizing) return;
        if (resizing === 'sidebar') {
            const newWidth = isSwapped ? window.innerWidth - e.clientX - propertiesWidth : e.clientX;
            setSidebarWidth(Math.max(200, Math.min(500, newWidth)));
        } else if (resizing === 'properties') {
            const newWidth = isSwapped ? e.clientX - sidebarWidth : window.innerWidth - e.clientX;
            setPropertiesWidth(Math.max(240, Math.min(600, newWidth)));
        }
    };

    const handleMouseUp = () => setResizing(null);

    useEffect(() => {
        if (resizing) {
            document.body.classList.add('resizing');
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        } else {
            document.body.classList.remove('resizing');
        }
        return () => {
            document.body.classList.remove('resizing');
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizing]);

    // ── Initial Load ─────────────────────────
    useEffect(() => {
        const STORAGE_KEY = 'lassez_studio_deck_v1';
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const { deck: sDeck, activeId: sActiveId } = JSON.parse(saved);
                if (sDeck && sDeck.length > 0) {
                    setDeck(sDeck);
                    setActiveId(sActiveId || sDeck[0].id);
                }
            } catch (e) {}
        } else {
            const defId = Math.random().toString(36).slice(2, 9);
            setDeck([{ id: defId, type: 'NEWS', label: 'Slide 1', state: { ...DN } }]);
            setActiveId(defId);
        }

        if (postId) {
            fetch('/api/radar?status=PENDING').then(r => r.json()).then(data => {
                if (data.success) {
                    const found = data.posts?.find((p: any) => p.id === parseInt(postId));
                    if (found) {
                        const title = found.source_title || '';
                        const body = found.flash_content || '';
                        setArticleInput(`${title}\n\n${body}`);
                        setDeck(d => d.map((s, i) => i === 0 ? { ...s, state: { ...s.state, headline: title } } : s));
                    }
                }
            }).catch(() => {});
        }
    }, [postId, setDeck, setActiveId, setArticleInput]);

    // ── Persistence ──────────────────────────
    useEffect(() => {
        if (deck.length === 0) return;
        const timer = setTimeout(() => {
            localStorage.setItem('lassez_studio_deck_v1', JSON.stringify({ deck, activeId: deck[0].id }));
        }, 1000);
        return () => clearTimeout(timer);
    }, [deck]);

    return (
        <div className="h-screen overflow-hidden flex flex-col" style={{ background: '#1b1b1b', fontFamily: 'Inter, system-ui, sans-serif', color: '#fff' }}>
            <style dangerouslySetInnerHTML={{ __html: CSS }} />

            <StudioToolbar 
                onShowArticleModal={() => setShowArticleModal(true)}
                onShowJsonImport={() => setShowJsonImport(true)}
                onExportPNG={handleExport}
                onExportZIP={handleExportAll}
                onExportJSON={handleExportJSON}
            />

            <div className="flex flex-1 overflow-hidden relative">
                {/* BUTTON SWAP POSITION */}
                <button 
                    onClick={() => setIsSwapped(!isSwapped)}
                    className="absolute top-1 left-1/2 -translate-x-1/2 z-50 bg-[#222] border border-[#333] text-[9px] px-2 py-0.5 rounded opacity-20 hover:opacity-100 transition-opacity"
                >
                    SWAP PANELS
                </button>

                {/* SIDEBAR GAUCHE (ou DROITE si Swapped) */}
                <div style={{ width: sidebarWidth, minWidth: 200, display: 'flex', order: isSwapped ? 2 : 0, position: 'relative' }}>
                    <StudioSidebar />
                </div>

                {/* RESIZER SIDEBAR */}
                <div 
                    onMouseDown={(e) => { e.preventDefault(); setResizing('sidebar'); }}
                    style={{ 
                        width: 8, 
                        marginLeft: -4,
                        marginRight: -4,
                        cursor: 'col-resize', 
                        background: resizing === 'sidebar' ? '#555' : 'transparent', 
                        zIndex: 100,
                        position: 'relative',
                        order: isSwapped ? 2 : 1 
                    }}
                    className="hover:bg-white/10 transition-colors"
                />
                
                {/* CANVAS CENTRAL */}
                <main className="flex-1 overflow-hidden flex flex-col" style={{ background: '#111', order: 1 }}>
                    <div style={{ background: '#1a1a1a', borderBottom: '1px solid #2a2a2a', height: 40 }} className="flex items-center px-6 gap-3 shrink-0">
                        <span style={{ fontSize: 11, color: '#666', fontFamily: 'Inter, sans-serif' }}>Studio</span>
                        <span style={{ color: '#333' }}>/</span>
                        <span style={{ fontSize: 11, color: '#999', fontFamily: 'Inter, sans-serif' }}>Slide Editor</span>
                        <div className="ml-auto">
                            <span style={{ fontSize: 10, color: '#444', fontFamily: 'Inter, sans-serif' }}>560 × 700 px</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto flex items-center justify-center p-10" style={{ 
                        background: '#111',
                        backgroundImage: 'radial-gradient(circle, #222 1px, transparent 1px)',
                        backgroundSize: '24px 24px'
                    }}>
                        <StudioCanvas exportRef={exportRef} />
                    </div>
                </main>

                {/* RESIZER PROPERTIES */}
                <div 
                    onMouseDown={(e) => { e.preventDefault(); setResizing('properties'); }}
                    style={{ 
                        width: 8, 
                        marginLeft: -4,
                        marginRight: -4,
                        cursor: 'col-resize', 
                        background: resizing === 'properties' ? '#555' : 'transparent', 
                        zIndex: 100,
                        position: 'relative',
                        order: isSwapped ? 0 : 2 
                    }}
                    className="hover:bg-white/10 transition-colors"
                />

                {/* PANNEAU DROITE (ou GAUCHE si Swapped) */}
                <div style={{ width: propertiesWidth, minWidth: 240, display: 'flex', order: isSwapped ? 0 : 2, position: 'relative' }}>
                    <StudioPropertiesPanel />
                </div>
            </div>

            <StudioExportBar progress={exportProgress} />
            
            <StudioModals 
                showArticleModal={showArticleModal}
                setShowArticleModal={setShowArticleModal}
                showJsonImport={showJsonImport}
                setShowJsonImport={setShowJsonImport}
                onImportJSON={(json) => {
                    try {
                        const data = JSON.parse(json);
                        if (data.deck) setDeck(data.deck);
                    } catch(e) { alert("Format JSON invalide"); }
                }}
                onGenerateDeck={(text, types) => {
                    aiGenerateDeck(text, types);
                    setShowArticleModal(false);
                }}
            />
        </div>
    );
}
