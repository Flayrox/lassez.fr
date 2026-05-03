'use client';

import React, { useState } from 'react';
import { useStudio, SlideType } from './StudioContext';
import { ICONS, DEFAULTS, DC, DN } from './constants';

export function StudioModals({ 
    showArticleModal, 
    setShowArticleModal,
    showJsonImport,
    setShowJsonImport,
    onImportJSON,
    onGenerateDeck
}: {
    showArticleModal: boolean;
    setShowArticleModal: (s: boolean) => void;
    showJsonImport: boolean;
    setShowJsonImport: (s: boolean) => void;
    onImportJSON: (json: string) => void;
    onGenerateDeck: (text: string, types: SlideType[]) => void;
}) {
    const { articleInput, setArticleInput, aiLoading, patchActive } = useStudio();
    const [jsonInput, setJsonInput] = useState('');
    
    const DEFAULT_AI_TYPES: SlideType[] = ['NEWS', 'MAXTEXT', 'GRANULAR', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST'];
    const [aiEnabledTypes, setAiEnabledTypes] = useState<SlideType[]>(DEFAULT_AI_TYPES);

    const toggleAiType = (t: SlideType) => {
        setAiEnabledTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
    };

    if (!showArticleModal && !showJsonImport) return null;

    const curAccent = '#DC2626'; // Default if not found

    return (
        <>
            {showArticleModal && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8">
                    <div className="bg-[#0d0d0d] border border-white/10 w-full max-w-2xl flex flex-col gap-4 p-6" style={{ boxShadow: `8px 8px 0 ${curAccent}` }}>
                        <div className="flex justify-between items-center">
                            <span className="sm text-[10px] uppercase font-bold" style={{ color: curAccent }}>✨ Générer le deck depuis un article</span>
                            <button onClick={() => setShowArticleModal(false)} className="sm text-[10px] text-gray-500 hover:text-white">✕ Fermer</button>
                        </div>
                        <p className="sm text-[9px] text-gray-500 uppercase">Colle ton article, ton flash info ou ton brief. L'IA va créer un deck de slides Instagram complet.</p>
                        <textarea
                            className="si w-full h-36 resize-none"
                            placeholder="Colle ton article ici…"
                            value={articleInput}
                            onChange={e => setArticleInput(e.target.value)}
                        />

                        <div className="border border-white/10 p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <p className="sm text-[9px] uppercase tracking-widest font-bold" style={{ color: curAccent }}>⚙ Paramètres IA — Templates autorisés</p>
                            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto sb">
                                {(['COVER', 'NEWS', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'] as SlideType[]).map((type) => {
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
                                            <p className="sm text-[9px] font-bold uppercase" style={{ color: isEnabled ? '#fff' : '#666' }}>{ICONS[type]} {type}</p>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowArticleModal(false)} className="sm text-[9px] px-4 py-2 border border-white/10 uppercase">Annuler</button>
                            <button onClick={() => onGenerateDeck(articleInput, aiEnabledTypes)} disabled={aiLoading || !articleInput.trim()}
                                className="sm text-[9px] px-5 py-2 font-bold uppercase text-black disabled:opacity-40"
                                style={{ background: curAccent }}>
                                {aiLoading ? '⏳ Génération…' : `✨ Générer (${aiEnabledTypes.length} types)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showJsonImport && (
                <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8">
                    <div className="bg-[#0d0d0d] border border-white/10 w-full max-w-2xl flex flex-col gap-4 p-6" style={{ boxShadow: `8px 8px 0 ${curAccent}` }}>
                        <div className="flex justify-between items-center">
                            <span className="sm text-[10px] uppercase font-bold text-white">📥 Importer un Deck (JSON)</span>
                            <button onClick={() => setShowJsonImport(false)} className="sm text-[10px] text-gray-500 hover:text-white">✕ Fermer</button>
                        </div>
                        <textarea
                            className="si w-full h-64 resize-none sm text-[10px] leading-relaxed"
                            placeholder="Colle le JSON ici…"
                            value={jsonInput}
                            onChange={e => setJsonInput(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                            <button onClick={() => setShowJsonImport(false)} className="sm text-[9px] px-4 py-2 border border-white/10 uppercase">Annuler</button>
                            <button onClick={() => { onImportJSON(jsonInput); setShowJsonImport(false); }} disabled={!jsonInput.trim()}
                                className="sm text-[9px] px-5 py-2 font-bold uppercase transition-colors"
                                style={{ background: '#fff', color: '#000' }}>
                                Importer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
