'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { DashboardLayout } from '../components/DashboardLayout';
import { useRadarAdmin } from '../components/RadarAdminContext';

import { StudioProvider, useStudio } from './components/StudioContext';
import { StudioSidebar } from './components/StudioSidebar';
import { StudioCanvas } from './components/StudioCanvas';
import { StudioToolbar } from './components/StudioToolbar';
import { StudioExportBar } from './components/StudioExportBar';
import { StudioModals } from './components/StudioModals';
import { useFFmpeg } from './hooks/useFFmpeg';
import { useStudioExport } from './hooks/useStudioExport';
import { useStudioAI } from './hooks/useStudioAI';
import { CSS, DN } from './components/constants';

/**
 * RADAR STUDIO v4.0 - HARMONIZED & DECOMPOSED
 * Traces to REQ-STUDIO-REFACTOR, REQ-OPTIMIZATION.
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
    const { isDaemonRunning, countdown } = useRadarAdmin();
    const { deck, setDeck, setActiveId, setArticleInput } = useStudio();
    const searchParams = useSearchParams();
    const postId = searchParams.get('id');
    
    const exportRef = useRef<HTMLDivElement>(null);
    const [showArticleModal, setShowArticleModal] = useState(false);
    const [showJsonImport, setShowJsonImport] = useState(false);

    const { loadFFmpeg, exportProgress, setExportProgress } = useFFmpeg();
    const { handleExport, handleExportAll, handleExportJSON } = useStudioExport(exportRef, loadFFmpeg, setExportProgress, postId);
    const { aiGenerateDeck } = useStudioAI();

    // ── Initial Load ─────────────────────────
    useEffect(() => {
        // 1. Load from LocalStorage
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
            // Default first slide
            const defId = Math.random().toString(36).slice(2, 9);
            setDeck([{ id: defId, type: 'NEWS', label: 'Slide 1', state: { ...DN } }]);
            setActiveId(defId);
        }

        // 2. Load from Radar Post if ID present
        if (postId) {
            fetch('/api/radar?status=PENDING').then(r => r.json()).then(data => {
                if (data.success) {
                    const found = data.posts?.find((p: any) => p.id === parseInt(postId));
                    if (found) {
                        const title = found.source_title || '';
                        const body = found.flash_content || '';
                        setArticleInput(`${title}\n\n${body}`);
                        // Pre-fill headline
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
        <DashboardLayout
            title="STUDIO DE CRÉATION"
            subtitle={countdown || "Moteur graphique harmonisé v4.0"}
            isDaemonRunning={isDaemonRunning}
            fullBleed={true}
        >
            <div className="bg-zinc-900 text-white h-full overflow-hidden flex flex-col sg">
                <style dangerouslySetInnerHTML={{ __html: CSS }} />

                <StudioToolbar 
                    onShowArticleModal={() => setShowArticleModal(true)}
                    onShowJsonImport={() => setShowJsonImport(true)}
                    onExportPNG={handleExport}
                    onExportZIP={handleExportAll}
                    onExportJSON={handleExportJSON}
                />

                <div className="flex flex-1 overflow-hidden">
                    <StudioSidebar />
                    
                    <main className="flex-1 bg-[#111] overflow-hidden relative flex items-center justify-center p-12">
                        <div className="absolute inset-0 halftone opacity-5 pointer-events-none"></div>
                        <StudioCanvas exportRef={exportRef} />
                    </main>
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
        </DashboardLayout>
    );
}
