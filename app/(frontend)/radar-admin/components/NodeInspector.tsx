'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';

interface NodeInspectorProps {
    nodes: any[];
    settings?: any;
    onUpdateNode: (id: string, updates: any) => Promise<void>;
    onDeleteNode?: (id: string) => void;
}

// Fallback models if registry is empty
const DEFAULT_AI_MODELS = [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite' },
];

const SOCIAL_PLATFORMS = [
    { key: 'mastodon', label: 'Mastodon', icon: '🐘' },
    { key: 'bluesky', label: 'Bluesky', icon: '🦋' },
    { key: 'twitter', label: 'X / Twitter', icon: '🐦' },
    { key: 'discord', label: 'Discord', icon: '🔔' },
];

const CONTENT_TYPES = [
    '🔴 ALERTE INFO !',
    '📌 LE FAIT DU JOUR',
    '🔎 DÉCRYPTAGE',
    '🗓️ À VENIR'
];

export function NodeInspector({ nodes, settings, onUpdateNode, onDeleteNode }: NodeInspectorProps) {
    const { selectedNodeId, setSelectedNodeId } = useUI();
    const [localNode, setLocalNode] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'pending' | 'syncing' | 'saved' | 'error'>('idle');
    const syncTimeout = useRef<NodeJS.Timeout | null>(null);

    const aiModels = React.useMemo(() => {
        try {
            const parsed = JSON.parse(settings?.availableModelsJson || '[]');
            return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_AI_MODELS;
        } catch (e) {
            return DEFAULT_AI_MODELS;
        }
    }, [settings?.availableModelsJson]);
    
    useEffect(() => {
        const n = nodes.find(item => item.id === selectedNodeId);
        if (n) {
            setLocalNode(JSON.parse(JSON.stringify(n)));
            setSyncStatus('idle');
        }
    }, [selectedNodeId]);

    if (!localNode || !selectedNodeId) return null;

    const handleCommit = async () => {
        setSyncStatus('syncing');
        try {
            await onUpdateNode(localNode.id, localNode);
            setSyncStatus('saved');
            if (syncTimeout.current) clearTimeout(syncTimeout.current);
            syncTimeout.current = setTimeout(() => setSyncStatus('idle'), 3000);
        } catch (e) {
            setSyncStatus('error');
        }
    };

    const handleChange = (field: string, value: any, isSetting = false, index?: number) => {
        const nextNode = { ...localNode };
        if (isSetting && typeof index === 'number') {
            nextNode.settings[index].value = value;
        } else {
            (nextNode as any)[field] = value;
        }
        setLocalNode(nextNode);
        setSyncStatus('pending');
    };

    const toggleRouting = (contentType: string, platformKey: string, currentJson: string, idx: number) => {
        let obj: any = {};
        try { obj = JSON.parse(currentJson); } catch (e) { obj = {}; }
        if (!obj[contentType]) obj[contentType] = {};
        obj[contentType][platformKey] = !obj[contentType][platformKey];
        handleChange('settings', JSON.stringify(obj, null, 4), true, idx);
    };

    const renderField = (s: any, idx: number) => {
        const key = (s?.key || '').toLowerCase();
        const label = (s?.label || key || 'Parameter');
        const value = s?.value ?? '';

        const isModelSelector = key.includes('model');
        const isSlider = key.includes('threshold') || key.includes('similarity');
        
        const isToggle = typeof value === 'boolean' || 
                         ['true', 'false', '1', '0'].includes(String(value).toLowerCase()) ||
                         label.toLowerCase().includes('enabled') || 
                         label.toLowerCase().includes('approve') || 
                         label.toLowerCase().includes('pilot') ||
                         key.includes('search');

        const isDistribution = key.includes('social_targets_by_type_json');
        const isTextarea = (key.includes('prompt') || key.includes('feeds') || key.includes('channels') || key.includes('queries') || key.includes('accounts') || key.includes('json')) && !isDistribution;

        if (isDistribution) {
            let obj: any = {};
            try { obj = JSON.parse(value); } catch (e) { obj = {}; }
            return (
                <div className="bg-white border border-slate-100 rounded-sm overflow-hidden">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                                <th className="text-left py-1.5 px-3 text-[8px] font-bold text-slate-400 uppercase tracking-tighter">Content type</th>
                                {SOCIAL_PLATFORMS.map(p => (
                                    <th key={p.key} className="text-center py-1.5 px-1 text-[8px] font-bold text-slate-400 uppercase tracking-tighter" title={p.label}>{p.icon}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-mono text-[10px]">
                            {CONTENT_TYPES.map(type => (
                                <tr key={type} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-1.5 px-3 font-medium text-slate-600 truncate max-w-[120px]">{type.replace(/[^\w\s]/gi, '').trim()}</td>
                                    {SOCIAL_PLATFORMS.map(p => {
                                        const isActive = obj[type]?.[p.key];
                                        return (
                                            <td key={p.key} className="text-center py-1 px-1">
                                                <button 
                                                    onClick={() => toggleRouting(type, p.key, value, idx)} 
                                                    className={`w-3.5 h-3.5 mx-auto rounded-sm border transition-all ${isActive ? 'bg-black border-black' : 'bg-white border-slate-200'}`}
                                                >
                                                    {isActive && <div className="w-1 h-1 mx-auto rounded-full bg-emerald-400" />}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        if (isSlider) {
            const floatVal = parseFloat(value) || 0.65;
            const displayVal = Math.round(floatVal * 100);
            return (
                <div className="space-y-2 py-1">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-black font-bold">{displayVal}%</span></div>
                    <input type="range" min="0.3" max="0.95" step="0.01" value={floatVal} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-black" />
                </div>
            );
        }

        if (isModelSelector) {
            return (
                <div className="relative">
                    <select value={value} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] font-mono font-bold focus:border-black outline-none appearance-none cursor-pointer pr-8">
                        <option value="">Select model...</option>
                        {aiModels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 pointer-events-none">unfold_more</span>
                </div>
            );
        }

        if (isToggle) {
            const val = value === true || String(value).toLowerCase() === 'true' || value === 1 || value === '1';
            return (
                <button 
                    onClick={() => handleChange('settings', !val, true, idx)} 
                    className={`flex items-center gap-2 px-3 py-1 rounded-sm border text-[10px] font-bold transition-all ${val ? 'bg-black text-white border-black' : 'bg-white text-slate-500 border-slate-200'}`}
                >
                    <div className={`w-1 h-1 rounded-full ${val ? 'bg-emerald-400 shadow-[0_0_2px_rgba(52,211,153,1)]' : 'bg-slate-300'}`} />
                    {val ? 'Enabled' : 'Disabled'}
                </button>
            );
        }

        if (isTextarea) {
            return (
                <textarea value={value} rows={5} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-2 text-[11px] font-mono focus:bg-white focus:border-black outline-none transition-all resize-none leading-relaxed" placeholder="Enter values..." />
            );
        }

        return (
            <input type="text" value={value} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full border border-slate-200 bg-white rounded-sm px-3 py-1.5 text-[11px] font-mono focus:border-black outline-none transition-all" />
        );
    };

    return (
        <AnimatePresence>
            <motion.div 
                drag dragMomentum={false}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="fixed z-[800] w-[380px] pointer-events-auto right-8 top-16"
            >
                <div className="bg-white border border-slate-200 rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                    <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between cursor-move select-none">
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: localNode.color?.replace('text-', '') || '#000' }} />
                            <span className="text-[11px] font-bold text-black uppercase tracking-tighter">Node inspector</span>
                        </div>
                        <button onClick={() => setSelectedNodeId(null)} className="text-slate-400 hover:text-black transition-colors">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                    
                    <div className="p-5 space-y-6 overflow-y-auto custom-scrollbar bg-white">
                        <section className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Identity</label>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-medium text-slate-500">Instance label</span>
                                <input type="text" value={localNode.label || ''} onChange={(e) => handleChange('label', e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-sm px-3 py-1.5 text-[11px] font-bold focus:bg-white focus:border-black outline-none transition-all" />
                            </div>
                        </section>

                        <section className="space-y-4">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">Rules engine</label>
                            <div className="space-y-5">
                                {localNode.settings?.map((s: any, idx: number) => (
                                    <div key={idx} className="space-y-1.5">
                                        <span className="text-[10px] font-bold text-slate-500">{s?.label || s?.key}</span>
                                        {renderField(s, idx)}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <button 
                            onClick={() => onDeleteNode?.(localNode.id)}
                            className="flex items-center gap-1.5 text-slate-400 hover:text-rose-500 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                            <span className="text-[10px] font-bold">Delete</span>
                        </button>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedNodeId(null)} className="px-3 py-1 text-slate-400 text-[11px] font-bold hover:text-black transition-all">Cancel</button>
                            <button 
                                onClick={handleCommit}
                                disabled={syncStatus === 'syncing'}
                                className={`px-5 py-1 text-[11px] font-bold rounded-sm transition-all ${
                                    syncStatus === 'pending' ? 'bg-black text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                {syncStatus === 'syncing' ? 'Syncing...' : 'Commit changes'}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
