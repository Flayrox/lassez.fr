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
            <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-1">Cortex Intelligence</h3>
                <p className="text-[11px] text-slate-500 font-medium">Fine-tune the AI agents and their processing logic.</p>
            </div>

            <div className="grid gap-10">
                <section className="space-y-6">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Model Selection</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Main Editorial Agent</label>
                                <div className="flex items-center gap-1 opacity-40">
                                    <span className="material-symbols-outlined text-slate-400 text-[12px]">public_off</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase">Search Off</span>
                                </div>
                            </div>
                            <select 
                                value={form.ai_model_main || ''} 
                                onChange={e => updateForm('ai_model_main', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none"
                            >
                                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Researcher Agent (OSINT)</label>
                                <div className="flex items-center gap-1">
                                    <span className="material-symbols-outlined text-emerald-500 text-[12px]">public</span>
                                    <span className="text-[8px] font-bold text-emerald-600 uppercase">Google Search ON</span>
                                </div>
                            </div>
                            <select 
                                value={form.ai_model_breaking || ''} 
                                onChange={e => updateForm('ai_model_breaking', e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none"
                            >
                                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    </div>
                </section>

                <section className="space-y-6 pt-10 border-t border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deduplication Logic</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Similarity Threshold</label>
                                <span className="text-[10px] font-black">{Math.round((form.dedup_similarity_threshold || 0.65) * 100)}%</span>
                            </div>
                            <input 
                                type="range" 
                                min="0" max="1" step="0.05"
                                value={form.dedup_similarity_threshold || 0.65}
                                onChange={e => updateForm('dedup_similarity_threshold', parseFloat(e.target.value))}
                                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-black"
                            />
                            <p className="text-[9px] text-slate-400 leading-relaxed italic">Lower = More strict (fewer articles). Higher = More inclusive.</p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Lookback Window (Hours)</label>
                            <input 
                                type="number" 
                                value={form.dedup_recent_hours || 24}
                                onChange={e => updateForm('dedup_recent_hours', parseInt(e.target.value))}
                                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none"
                            />
                        </div>
                    </div>
                </section>

                <section className="space-y-6 pt-10 border-t border-slate-100">
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Video Ingestion</h4>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <div>
                            <p className="text-[11px] font-bold text-slate-900">Process Video Metadata</p>
                            <p className="text-[10px] text-slate-500">Transcribe and analyze Telegram video attachments using Gemini Multimodal.</p>
                        </div>
                        <button 
                            onClick={() => updateForm('video_ingest_enabled', form.video_ingest_enabled === 'true' ? 'false' : 'true')}
                            className={`w-12 h-6 rounded-full transition-all relative ${form.video_ingest_enabled === 'true' ? 'bg-black' : 'bg-slate-200'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.video_ingest_enabled === 'true' ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
