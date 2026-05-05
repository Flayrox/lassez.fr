'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';

interface NodeInspectorProps {
    nodes: any[];
    onUpdateNode: (id: string, updates: any) => Promise<void>;
    onDeleteNode?: (id: string) => void;
}

const AI_MODELS = [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-pro-exp', label: 'Gemini 2.0 Pro Exp' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
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

export function NodeInspector({ nodes, onUpdateNode, onDeleteNode }: NodeInspectorProps) {
    const { selectedNodeId, setSelectedNodeId } = useUI();
    const [localNode, setLocalNode] = useState<any>(null);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'pending' | 'syncing' | 'saved' | 'error'>('idle');
    const syncTimeout = useRef<NodeJS.Timeout | null>(null);
    
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
        
        // Advanced Toggle Detection
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
                <div className="space-y-4 bg-white border border-slate-200 p-4 rounded-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-left py-2 pr-4 text-[7px] font-black uppercase text-slate-300 tracking-tighter">Content Type</th>
                                    {SOCIAL_PLATFORMS.map(p => (
                                        <th key={p.key} className="text-center py-2 px-1 text-[7px] font-black uppercase text-slate-300 tracking-tighter" title={p.label}>{p.icon}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {CONTENT_TYPES.map(type => (
                                    <tr key={type} className="group hover:bg-slate-50 transition-colors">
                                        <td className="py-2.5 pr-4"><span className="text-[9px] font-black text-slate-500 whitespace-nowrap">{type}</span></td>
                                        {SOCIAL_PLATFORMS.map(p => {
                                            const isActive = obj[type]?.[p.key];
                                            return (
                                                <td key={p.key} className="text-center py-2 px-1">
                                                    <button onClick={() => toggleRouting(type, p.key, value, idx)} className={`w-5 h-5 rounded-sm border flex items-center justify-center transition-all ${isActive ? 'bg-black border-black shadow-sm' : 'bg-white border-slate-200 opacity-30 hover:opacity-100'}`}>
                                                        {isActive && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                                                    </button>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        if (isSlider) {
            const floatVal = parseFloat(value) || 0.65;
            const displayVal = Math.round(floatVal * 100);
            return (
                <div className="space-y-3 py-1">
                    <div className="flex justify-between items-center"><span className="text-[10px] font-mono text-black font-black">{displayVal}%</span></div>
                    <input type="range" min="0.3" max="0.95" step="0.01" value={floatVal} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full h-1 bg-slate-100 rounded-full appearance-none cursor-pointer accent-black" />
                </div>
            );
        }

        if (isModelSelector) {
            return (
                <div className="relative">
                    <select value={value} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[10px] font-bold focus:border-black outline-none appearance-none cursor-pointer pr-8">
                        <option value="">Select model...</option>
                        {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
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
                    className={`flex items-center gap-3 px-4 py-2 rounded-sm border text-[9px] font-black transition-all ${val ? 'bg-black text-white border-black shadow-md' : 'bg-white text-slate-400 border-slate-200'}`}
                >
                    <div className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-400' : 'bg-slate-300'}`} />
                    {val ? 'ENABLED' : 'DISABLED'}
                </button>
            );
        }

        if (isTextarea) {
            return (
                <textarea value={value} rows={6} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[10px] font-mono focus:border-black outline-none transition-all resize-none leading-relaxed" placeholder="Enter values..." />
            );
        }

        return (
            <input type="text" value={value} onChange={(e) => handleChange('settings', e.target.value, true, idx)} className="w-full border border-slate-200 bg-white rounded-sm px-3 py-2 text-[10px] font-mono focus:border-black outline-none transition-all" />
        );
    };

    return (
        <AnimatePresence>
            <motion.div 
                drag dragMomentum={false}
                initial={{ opacity: 0, scale: 0.98, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.98, x: 20 }}
                className="fixed z-[800] w-[420px] pointer-events-auto right-12 top-24"
            >
                <div className="bg-white border border-slate-300 rounded-sm shadow-[0_32px_64px_-12px_rgba(0,0,0,0.22)] overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="px-5 py-4 bg-white border-b border-slate-100 flex items-center justify-between cursor-move select-none">
                        <div className="flex items-center gap-3">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: localNode.color?.replace('text-', '') || '#000' }} />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-black">Orchestrator Settings</span>
                        </div>
                        <button onClick={() => setSelectedNodeId(null)} className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded-sm transition-colors group">
                            <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-black">close</span>
                        </button>
                    </div>
                    
                    <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar">
                        <section>
                            <label className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] block mb-4">Identification</label>
                            <div className="flex flex-col gap-2">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Instance Label</span>
                                <input type="text" value={localNode.label || ''} onChange={(e) => handleChange('label', e.target.value)} className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[11px] font-bold focus:border-black outline-none shadow-sm" />
                            </div>
                        </section>

                        <section>
                            <label className="text-[8px] font-black text-slate-300 uppercase tracking-[0.2em] block mb-5">Rules Engine</label>
                            <div className="space-y-7">
                                {localNode.settings?.map((s: any, idx: number) => (
                                    <div key={idx} className="flex flex-col gap-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{s?.label || s?.key}</span>
                                        </div>
                                        {renderField(s, idx)}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => onDeleteNode?.(localNode.id)}
                                className="flex items-center gap-2 text-rose-500 hover:text-rose-700 transition-colors group"
                            >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                                <span className="text-[9px] font-black uppercase tracking-widest">Delete Node</span>
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => setSelectedNodeId(null)} className="px-4 py-2 text-slate-400 text-[10px] font-black uppercase rounded-sm hover:text-black transition-all">Cancel</button>
                            <button 
                                onClick={handleCommit}
                                disabled={syncStatus === 'syncing'}
                                className={`px-8 py-2 text-[10px] font-black uppercase rounded-sm transition-all shadow-lg ${
                                    syncStatus === 'pending' ? 'bg-black text-white hover:bg-zinc-800' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                Commit
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
