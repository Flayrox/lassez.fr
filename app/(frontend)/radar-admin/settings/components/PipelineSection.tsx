'use client';

import React from 'react';

interface PipelineSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

const MODELS = [
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.0-pro-exp',
    'gemini-1.5-pro',
];

export function PipelineSection({ form, updateForm }: PipelineSectionProps) {
    return (
        <div className="space-y-10">
            <div className="flex justify-between items-end">
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">Cortex Intelligence</h3>
                    <p className="text-[11px] text-slate-500 font-medium italic">Fine-tune the neural weights of your investigation agents.</p>
                </div>
                <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded">LLM V3 Active</span>
                </div>
            </div>

            <div className="grid gap-10">
                {/* Model Selection */}
                <section className="space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Processing Models</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Editorialist (IA Pro)</label>
                            <select 
                                value={form.aiModelPro || 'gemini-3-flash-preview'} 
                                onChange={e => updateForm('aiModelPro', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none transition-all"
                            >
                                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Researcher (IA Flash)</label>
                            <select 
                                value={form.aiModelFlash || 'gemini-3.1-flash-lite-preview'} 
                                onChange={e => updateForm('aiModelFlash', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none transition-all"
                            >
                                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                {/* Deduplication & Logic */}
                <section className="space-y-6 pt-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Neural Filtering</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Similarity Threshold</label>
                                <span className="text-[10px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded">{Math.round((form.similarityThreshold || 0.45) * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0.1" max="0.9" step="0.05"
                                value={form.similarityThreshold || 0.45}
                                onChange={e => updateForm('similarityThreshold', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-black"
                            />
                            <p className="text-[9px] text-slate-400 italic">Determines cluster grouping sensitivity.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Lookback Window (Hours)</label>
                            <input 
                                type="number" 
                                value={form.dedupLookbackHours || 24}
                                onChange={e => updateForm('dedupLookbackHours', parseInt(e.target.value))}
                                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:border-black transition-all"
                            />
                        </div>
                    </div>
                </section>

                {/* Custom Prompt Modifier */}
                <section className="space-y-4 pt-2">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Editorial Directives</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Target Keywords (Focus)</label>
                            <textarea 
                                value={form.keywords || ''} 
                                onChange={e => updateForm('keywords', e.target.value)}
                                placeholder="Ex: AI, Deepmind, Robotics..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium min-h-[100px] outline-none focus:bg-white focus:border-black transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Banned Keywords (Noise)</label>
                            <textarea 
                                value={form.bannedKeywords || ''} 
                                onChange={e => updateForm('bannedKeywords', e.target.value)}
                                placeholder="Ex: Crypto, NFT, Sports..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium min-h-[100px] outline-none focus:bg-white focus:border-black transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-2 pt-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Global Prompt Override</label>
                        <textarea 
                            value={form.customPromptModifier || ''} 
                            onChange={e => updateForm('customPromptModifier', e.target.value)}
                            placeholder="Ex: Sois particulièrement critique sur les annonces gouvernementales aujourd'hui..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-medium min-h-[80px] outline-none focus:bg-white focus:border-black transition-all"
                        />
                    </div>
                </section>

                {/* Toggles */}
                <section className="pt-4 grid grid-cols-1 gap-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                        <div>
                            <p className="text-[11px] font-black text-slate-900 uppercase">Multimodal Video Analysis</p>
                            <p className="text-[10px] text-slate-500 italic">Analyze Telegram video content using Vision capabilities.</p>
                        </div>
                        <button 
                            onClick={() => updateForm('videoIngestEnabled', !form.videoIngestEnabled)}
                            className={`w-10 h-5 rounded-full transition-all relative ${form.videoIngestEnabled ? 'bg-black' : 'bg-slate-300'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${form.videoIngestEnabled ? 'left-6' : 'left-1'}`} />
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
