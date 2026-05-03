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

    // Payload Theme Constants
    const theme = {
        bg: '#131313',
        border: '#2a2a2a',
        inputBg: '#1a1a1a',
        text: '#fff',
        textMuted: '#999',
        accent: '#fff' // Primary CTA
    };

    const ModalContainer = ({ children, onClose, title, subtitle }: { children: React.ReactNode, onClose: () => void, title: string, subtitle?: string }) => (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-8 backdrop-blur-sm transition-all animate-in fade-in duration-300">
            <div className="border shadow-2xl flex flex-col w-full max-w-2xl overflow-hidden rounded-xl animate-in zoom-in-95 duration-200" 
                 style={{ background: theme.bg, borderColor: theme.border, fontFamily: 'Inter, sans-serif' }}>
                
                {/* Header */}
                <div className="px-6 py-5 border-b flex justify-between items-center bg-[#111]" style={{ borderColor: theme.border }}>
                    <div>
                        <h3 className="text-[13px] font-bold text-white uppercase tracking-wider">{title}</h3>
                        {subtitle && <p className="text-[11px] text-[#666] mt-1 font-medium">{subtitle}</p>}
                    </div>
                    <button 
                        onClick={onClose} 
                        className="text-[#666] hover:text-white transition-colors p-1 hover:bg-white/5 rounded-full"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                <div className="p-6 flex flex-col gap-5 overflow-y-auto max-h-[80vh] sb">
                    {children}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {showArticleModal && (
                <ModalContainer 
                    onClose={() => setShowArticleModal(false)}
                    title="✨ Générer le deck depuis un article"
                    subtitle="Colle ton article ou ton flash info. L'IA va créer un deck complet."
                >
                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-[#999] uppercase tracking-tight ml-1">Contenu de l'article</label>
                        <textarea
                            className="w-full h-40 resize-none p-4 text-[12px] text-white focus:outline-none focus:border-[#555] transition-colors rounded-lg"
                            style={{ background: theme.inputBg, border: `1px solid ${theme.border}`, fontFamily: 'Inter, sans-serif' }}
                            placeholder="Colle ton texte ici..."
                            value={articleInput}
                            onChange={e => setArticleInput(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-[11px] font-bold text-[#999] uppercase tracking-tight ml-1">Paramètres IA — Templates autorisés</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['COVER', 'NEWS', 'MAXTEXT', 'GRANULAR', 'BIG_NUM', 'INFO', 'ANALYSIS', 'OUTRO', 'COMPARISON_CHART', 'STACKED_DATA', 'VOTE_TRACKER', 'TERRITORY_RADAR', 'DECODING', 'CHRONO_LOCK', 'IMPACT_QUOTE', 'SOCIAL_COST', 'VIDEO_NOTE'] as SlideType[]).map((type) => {
                                const isEnabled = aiEnabledTypes.includes(type);
                                return (
                                    <button 
                                        key={type} 
                                        onClick={() => toggleAiType(type)}
                                        className="flex items-center gap-3 p-3 text-left border rounded-lg transition-all hover:border-[#555] active:scale-95"
                                        style={{
                                            borderColor: isEnabled ? '#fff' : theme.border,
                                            background: isEnabled ? 'rgba(255,255,255,0.06)' : 'transparent'
                                        }}
                                    >
                                        <div className="w-3.5 h-3.5 border flex items-center justify-center shrink-0 rounded-[2px]"
                                             style={{ borderColor: isEnabled ? '#fff' : '#444', background: isEnabled ? '#fff' : 'transparent' }}>
                                            {isEnabled && <span className="text-black text-[10px] font-bold">✓</span>}
                                        </div>
                                        <span className="text-[11px] font-semibold" style={{ color: isEnabled ? '#fff' : '#777' }}>
                                            {type.replace('_', ' ')}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t mt-2 justify-end" style={{ borderColor: theme.border }}>
                        <button 
                            onClick={() => setShowArticleModal(false)} 
                            className="text-[11px] font-bold px-5 py-2.5 border transition-all hover:bg-white/5 active:scale-95 rounded-lg uppercase tracking-wide"
                            style={{ color: '#fff', borderColor: theme.border }}
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={() => onGenerateDeck(articleInput, aiEnabledTypes)} 
                            disabled={aiLoading || !articleInput.trim()}
                            className="text-[11px] font-bold px-6 py-2.5 bg-white text-black transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-30 rounded-lg uppercase tracking-wide flex items-center gap-2"
                        >
                            {aiLoading ? (
                                <>
                                    <span className="animate-spin duration-700">◌</span>
                                    Génération...
                                </>
                            ) : (
                                <>✨ Générer ({aiEnabledTypes.length})</>
                            )}
                        </button>
                    </div>
                </ModalContainer>
            )}

            {showJsonImport && (
                <ModalContainer 
                    onClose={() => setShowJsonImport(false)}
                    title="📥 Importer un Deck (JSON)"
                    subtitle="Colle la structure JSON brute d'un deck sauvegardé."
                >
                    <textarea
                        className="w-full h-80 resize-none p-4 text-[11px] leading-relaxed text-white focus:outline-none focus:border-[#555] transition-colors rounded-lg font-mono"
                        style={{ background: theme.inputBg, border: `1px solid ${theme.border}` }}
                        placeholder="[{ id: '...', type: '...', state: { ... } }]"
                        value={jsonInput}
                        onChange={e => setJsonInput(e.target.value)}
                    />
                    
                    <div className="flex gap-3 pt-4 border-t mt-2 justify-end" style={{ borderColor: theme.border }}>
                        <button 
                            onClick={() => setShowJsonImport(false)} 
                            className="text-[11px] font-bold px-5 py-2.5 border transition-all hover:bg-white/5 active:scale-95 rounded-lg uppercase tracking-wide"
                            style={{ color: '#fff', borderColor: theme.border }}
                        >
                            Annuler
                        </button>
                        <button 
                            onClick={() => { onImportJSON(jsonInput); setShowJsonImport(false); }} 
                            disabled={!jsonInput.trim()}
                            className="text-[11px] font-bold px-6 py-2.5 bg-white text-black transition-all hover:bg-zinc-200 active:scale-95 disabled:opacity-30 rounded-lg uppercase tracking-wide"
                        >
                            Importer
                        </button>
                    </div>
                </ModalContainer>
            )}
        </>
    );
}
