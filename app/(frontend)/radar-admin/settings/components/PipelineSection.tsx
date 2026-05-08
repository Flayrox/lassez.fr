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
        <div className="space-y-8">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-black">Cortex intelligence</h3>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">v3.1 Active</span>
            </div>

            <div className="grid gap-6">
                {/* Processing Models */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-slate-400">Editorialist (IA Pro)</label>
                        <select 
                            value={form.aiModelPro || 'gemini-3-flash-preview'} 
                            onChange={e => updateForm('aiModelPro', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] font-mono font-bold focus:border-black outline-none transition-all"
                        >
                            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-slate-400">Researcher (IA Flash)</label>
                        <select 
                            value={form.aiModelFlash || 'gemini-3.1-flash-lite-preview'} 
                            onChange={e => updateForm('aiModelFlash', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] font-mono font-bold focus:border-black outline-none transition-all"
                        >
                            {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>

                {/* Neural Filtering */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-medium text-slate-400">Similarity threshold</label>
                            <span className="text-[10px] font-mono font-bold">{Math.round((form.similarityThreshold || 0.45) * 100)}%</span>
                        </div>
                        <input 
                            type="range" min="0.1" max="0.9" step="0.05"
                            value={form.similarityThreshold || 0.45}
                            onChange={e => updateForm('similarityThreshold', parseFloat(e.target.value))}
                            className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-black"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-slate-400">Lookback window (hours)</label>
                        <input 
                            type="number" 
                            value={form.dedupLookbackHours || 24}
                            onChange={e => updateForm('dedupLookbackHours', parseInt(e.target.value))}
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] font-mono font-bold focus:border-black outline-none transition-all"
                        />
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-sm border border-slate-100 md:col-span-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-black uppercase tracking-tighter">Global Image Enrichment</span>
                            <span className="text-[9px] text-slate-400">Enable/Disable automatic OSINT image search for all nodes</span>
                        </div>
                        <button 
                            onClick={() => updateForm('allowSourceImages', !form.allowSourceImages)}
                            className={`w-8 h-4.5 rounded-full relative transition-all ${form.allowSourceImages ? 'bg-black' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${form.allowSourceImages ? 'left-4' : 'left-0.5'}`} />
                        </button>
                    </div>
                </div>

                {/* Editorial Directives */}
                <div className="space-y-4 pt-4 border-t border-slate-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-medium text-slate-400">Target keywords (Focus)</label>
                            <textarea 
                                value={form.keywords || ''} 
                                onChange={e => updateForm('keywords', e.target.value)}
                                placeholder="AI, Deepmind, Robotics..."
                                className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] min-h-[60px] focus:border-black outline-none transition-all"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-medium text-slate-400">Banned keywords (Noise)</label>
                            <textarea 
                                value={form.bannedKeywords || ''} 
                                onChange={e => updateForm('bannedKeywords', e.target.value)}
                                placeholder="Crypto, NFT, Sports..."
                                className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] min-h-[60px] focus:border-black outline-none transition-all"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-medium text-slate-400">Global prompt override</label>
                        <textarea 
                            value={form.customPromptModifier || ''} 
                            onChange={e => updateForm('customPromptModifier', e.target.value)}
                            placeholder="Add specific instructions for the current cycle..."
                            className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] min-h-[40px] focus:border-black outline-none transition-all"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
