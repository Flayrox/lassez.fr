'use client';

import React, { useState, useEffect } from 'react';

interface PromptBlock {
    key: string;
    label: string;
    description: string;
    icon: string;
}

const PROMPT_BLOCKS: PromptBlock[] = [
    { key: 'baseIdentityPrompt', label: 'Editorial Identity', description: 'The persona and tone of the AI. Defines who "L\'Assez" is.', icon: 'person' },
    { key: 'researchMissionPrompt', label: 'Research Mission', description: 'Instructions for fact-checking, sourcing, and investigative depth.', icon: 'search' },
    { key: 'vocabularyRulesPrompt', label: 'Vocabulary Rules', description: 'Forbidden words, authorized terms, and translation rules for political language.', icon: 'spellcheck' },
    { key: 'imageRulesPrompt', label: 'Image Rules', description: 'The "Tir 1/2/3" method for selecting relevant images.', icon: 'image' },
    { key: 'researcherSystemPrompt', label: 'Researcher Directive', description: 'Filtering criteria for the triage AI. What topics to keep vs reject.', icon: 'psychology' },
    { key: 'researcherRejectCriteria', label: 'Rejection Criteria', description: 'Explicit list of content categories to automatically reject.', icon: 'block' },
];

interface Props {
    settings: any;
    onSave: (updates: Record<string, string>) => Promise<void>;
}

export function PromptSection({ settings, onSave }: Props) {
    const [localValues, setLocalValues] = useState<Record<string, string>>({});
    const [expanded, setExpanded] = useState<string | null>(null);
    const [dirty, setDirty] = useState<Set<string>>(new Set());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!settings) return;
        const values: Record<string, string> = {};
        PROMPT_BLOCKS.forEach(block => {
            values[block.key] = settings[block.key] || '';
        });
        setLocalValues(values);
    }, [settings]);

    const handleChange = (key: string, value: string) => {
        setLocalValues(prev => ({ ...prev, [key]: value }));
        setDirty(prev => new Set(prev).add(key));
    };

    const handleSave = async () => {
        if (dirty.size === 0) return;
        setSaving(true);
        try {
            const updates: Record<string, string> = {};
            dirty.forEach(key => { updates[key] = localValues[key]; });
            await onSave(updates);
            setDirty(new Set());
        } finally {
            setSaving(false);
        }
    };

    const handleReset = (key: string) => {
        if (!confirm('Reset this prompt block to factory default? (It will be reloaded from the original code on next daemon cycle)')) return;
        // Setting to empty string will make the backend fall back to hardcoded default
        handleChange(key, '');
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-black text-black uppercase tracking-tight">Prompt Engineering</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Edit the core prompt blocks that define the AI's editorial behavior.</p>
                </div>
                {dirty.size > 0 && (
                    <button 
                        onClick={handleSave} disabled={saving}
                        className="px-5 py-2 bg-black text-white text-xs font-bold rounded-sm hover:bg-zinc-800 transition-all flex items-center gap-2"
                    >
                        {saving ? 'Saving...' : `Save ${dirty.size} Change${dirty.size > 1 ? 's' : ''}`}
                    </button>
                )}
            </div>

            <div className="space-y-2">
                {PROMPT_BLOCKS.map(block => (
                    <div key={block.key} className="border border-slate-200 rounded-sm overflow-hidden bg-white">
                        <div 
                            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50/50 transition-colors"
                            onClick={() => setExpanded(expanded === block.key ? null : block.key)}
                        >
                            <div className="flex items-center gap-3">
                                <span className="material-symbols-outlined text-slate-400 text-lg">{block.icon}</span>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-black">{block.label}</span>
                                        {dirty.has(block.key) && <span className="text-[8px] font-bold text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded">Modified</span>}
                                    </div>
                                    <p className="text-[10px] text-slate-400">{block.description}</p>
                                </div>
                            </div>
                            <span className="material-symbols-outlined text-slate-300">{expanded === block.key ? 'expand_less' : 'expand_more'}</span>
                        </div>
                        {expanded === block.key && (
                            <div className="border-t border-slate-100 p-4 space-y-3">
                                <textarea 
                                    value={localValues[block.key] || ''} 
                                    onChange={(e) => handleChange(block.key, e.target.value)}
                                    rows={10} 
                                    className="w-full border border-slate-200 rounded-sm px-4 py-3 text-xs font-mono leading-relaxed focus:border-black outline-none resize-y bg-slate-50"
                                    placeholder="(Using factory default — edit to customize)"
                                />
                                <div className="flex justify-between items-center">
                                    <button onClick={() => handleReset(block.key)} className="text-[10px] text-slate-400 hover:text-rose-500 font-bold flex items-center gap-1">
                                        <span className="material-symbols-outlined text-xs">restart_alt</span> Reset to Factory
                                    </button>
                                    <span className="text-[9px] text-slate-300 font-mono">{(localValues[block.key] || '').length} chars</span>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
