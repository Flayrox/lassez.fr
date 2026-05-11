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

    const handleCommit = async (nodeToSave = localNode) => {
        setSyncStatus('syncing');
        try {
            await onUpdateNode(nodeToSave.id, nodeToSave);
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

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                className="fixed z-[1000] w-[420px] right-8 top-20 bottom-8 pointer-events-none"
            >
                <div className="bg-white border border-slate-200 rounded-sm shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] overflow-hidden flex flex-col h-full pointer-events-auto">
                    {/* Industrial Header */}
                    <div className={`px-5 py-4 flex items-center justify-between border-b border-slate-100 ${localNode.bg || 'bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                            <div className="p-2 bg-white rounded-sm shadow-sm">
                                <span className={`material-symbols-outlined text-[20px] ${localNode.color}`}>{localNode.icon}</span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[12px] font-black text-black uppercase tracking-tight">{localNode.label}</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] text-slate-400 font-mono bg-white px-1 border border-slate-100 rounded-sm">{localNode.id}</span>
                                    <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Instance</span>
                                </div>
                            </div>
                        </div>
                        <button onClick={() => setSelectedNodeId(null)} className="p-1.5 hover:bg-black/5 rounded-full transition-all">
                            <span className="material-symbols-outlined text-[20px] text-slate-400">close</span>
                        </button>
                    </div>
                    
                    <div className="flex-1 p-6 space-y-10 overflow-y-auto custom-scrollbar bg-white">
                        {/* Status Hub */}
                        <div className="flex justify-between items-center bg-slate-50/50 p-3 rounded-sm border border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${syncStatus === 'idle' || syncStatus === 'saved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Engine status</span>
                            </div>
                            <SyncMessage status={syncStatus} />
                        </div>

                        {/* Primary Label */}
                        <section className="space-y-4">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">General</h4>
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-black uppercase">Node friendly name</p>
                                <input 
                                    type="text" value={localNode.label || ''} 
                                    onChange={(e) => handleChange('label', e.target.value)} 
                                    className="w-full bg-slate-50 border border-slate-100 rounded-sm px-3 py-2.5 text-[12px] font-bold focus:bg-white focus:border-black outline-none transition-all placeholder-slate-300 shadow-inner" 
                                    placeholder="e.g. Master Researcher"
                                />
                            </div>
                        </section>

                        {/* Cortex Rules */}
                        <section className="space-y-8">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Operational Logic</h4>
                            <div className="space-y-8">
                                {localNode.settings?.map((s: any, idx: number) => (
                                    <div key={idx} className="space-y-3">
                                        <div className="flex justify-between items-end">
                                            <div className="space-y-0.5">
                                                <label className="text-[10px] font-black text-black uppercase">{s?.label || s?.key}</label>
                                                <p className="text-[9px] text-slate-400 font-medium leading-none">Control technical parameter</p>
                                            </div>
                                            {renderUnit(s.key, s.value)}
                                        </div>
                                        {renderProComponent(s, idx, handleChange, aiModels)}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Pro Footer */}
                    <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                        <button 
                            onClick={() => onDeleteNode?.(localNode.id)}
                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-sm transition-all"
                        >
                            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                        </button>
                        <div className="flex gap-3">
                            <button onClick={() => setSelectedNodeId(null)} className="px-4 py-2 text-slate-400 text-[11px] font-bold hover:text-black transition-all">Discard</button>
                            <button 
                                onClick={() => handleCommit()}
                                disabled={syncStatus === 'syncing' || syncStatus === 'idle'}
                                className={`px-6 py-2 text-[11px] font-black rounded-sm shadow-xl transition-all uppercase tracking-widest ${
                                    syncStatus === 'pending' || syncStatus === 'error' ? 'bg-black text-white hover:scale-[1.02] active:scale-[0.98]' : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }`}
                            >
                                {syncStatus === 'syncing' ? 'Syncing...' : 'Apply Config'}
                            </button>
                        </div>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

function SyncMessage({ status }: { status: string }) {
    if (status === 'idle') return <span className="text-[9px] font-bold text-emerald-600">UP TO DATE</span>;
    if (status === 'pending') return <span className="text-[9px] font-bold text-amber-500">CHANGES DETECTED</span>;
    if (status === 'syncing') return <span className="text-[9px] font-bold text-blue-500">COMMITTING...</span>;
    if (status === 'saved') return <span className="text-[9px] font-bold text-emerald-600">DATABASE SYNCED</span>;
    return null;
}

function renderUnit(key: string, value: any) {
    const k = key.toLowerCase();
    if (k.includes('threshold')) return <span className="text-[10px] font-mono font-bold text-black">{Math.round(value * 100)}% Match</span>;
    if (k.includes('interval') || k.includes('delay')) return <span className="text-[10px] font-mono font-bold text-black">{value} min</span>;
    if (k.includes('hours')) return <span className="text-[10px] font-mono font-bold text-black">{value}h Window</span>;
    return null;
}

function renderProComponent(s: any, idx: number, onChange: any, aiModels: any[]) {
    const key = (s?.key || '').toLowerCase();
    const value = s?.value ?? '';

    // 1. AI Models - Select
    if (key.includes('model')) {
        return (
            <div className="relative">
                <select 
                    value={value} 
                    onChange={(e) => onChange('settings', e.target.value, true, idx)} 
                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2.5 text-[12px] font-mono font-black focus:border-black outline-none appearance-none cursor-pointer pr-10 shadow-sm"
                >
                    {aiModels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none flex flex-col -gap-1">
                    <span className="material-symbols-outlined text-[14px] text-slate-400">expand_less</span>
                    <span className="material-symbols-outlined text-[14px] text-slate-400">expand_more</span>
                </div>
            </div>
        );
    }

    // 2. Collection Manager (Flux, Keywords, Channels)
    const listFields = ['rss_feeds', 'telegram_channels', 'google_news_queries', 'keywords', 'bannedkeywords', 'allowed_accounts'];
    if (listFields.includes(key)) {
        let list: string[] = [];
        try { 
            const parsed = typeof value === 'string' ? JSON.parse(value) : value;
            list = Array.isArray(parsed) ? parsed : [];
        } catch(e) { list = []; }

        return (
            <CollectionManager 
                items={list} 
                onChange={(newList) => onChange('settings', JSON.stringify(newList), true, idx)} 
                placeholder={key.includes('feed') ? 'https://rss-source.com/feed' : key.includes('channel') ? '@channel_name' : 'Enter value...'}
            />
        );
    }

    // 3. Social Routing Matrix
    if (key.includes('social_targets_by_type_json')) {
        let obj: any = {};
        try { obj = typeof value === 'string' ? JSON.parse(value) : value; } catch (e) { obj = {}; }
        return <ProSocialMatrix value={obj} onChange={(newObj) => onChange('settings', JSON.stringify(newObj, null, 2), true, idx)} />;
    }

    // 4. Sliders
    if (key.includes('threshold') || key.includes('similarity')) {
        return (
            <input 
                type="range" min="0.1" max="0.95" step="0.05"
                value={value || 0.5}
                onChange={(e) => onChange('settings', parseFloat(e.target.value), true, idx)}
                className="w-full h-1.5 bg-slate-100 rounded-full appearance-none cursor-pointer accent-black"
            />
        );
    }

    // 5. Toggles
    if (typeof value === 'boolean' || key.startsWith('enable') || key === 'allowsourceimages') {
        const val = value === true || String(value).toLowerCase() === 'true';
        return (
            <button 
                onClick={() => onChange('settings', !val, true, idx)}
                className={`w-full flex items-center justify-between p-3 rounded-sm border transition-all ${val ? 'bg-black border-black text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
            >
                <span className="text-[10px] font-black uppercase tracking-widest">{val ? 'Active' : 'Disabled'}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${val ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-200'}`} />
            </button>
        );
    }

    // 6. Generic Text/Number
    return (
        <input 
            type={typeof value === 'number' ? 'number' : 'text'} 
            value={value} 
            onChange={(e) => onChange('settings', typeof value === 'number' ? parseFloat(e.target.value) : e.target.value, true, idx)}
            className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2.5 text-[12px] font-bold focus:border-black outline-none transition-all shadow-sm"
        />
    );
}

// Composant Interne: Collection Manager (Senior Implementation)
function CollectionManager({ items, onChange, placeholder }: { items: string[], onChange: (next: string[]) => void, placeholder: string }) {
    const [input, setInput] = useState('');

    const add = () => {
        if (!input.trim()) return;
        if (items.includes(input.trim())) return;
        onChange([...items, input.trim()]);
        setInput('');
    };

    const remove = (idx: number) => {
        onChange(items.filter((_, i) => i !== idx));
    };

    return (
        <div className="space-y-3">
            <div className="flex gap-2">
                <input 
                    type="text" value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && add()}
                    placeholder={placeholder}
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-sm px-3 py-2 text-[11px] focus:bg-white focus:border-black outline-none transition-all"
                />
                <button onClick={add} className="px-3 bg-black text-white rounded-sm text-[11px] font-bold hover:bg-zinc-800 transition-all">Add</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 px-2 py-1 rounded-sm group hover:border-slate-400 transition-all">
                        <span className="text-[10px] font-medium text-slate-600 truncate max-w-[150px]">{item}</span>
                        <button onClick={() => remove(i)} className="text-slate-300 hover:text-rose-500 transition-colors">
                            <span className="material-symbols-outlined text-[12px]">close</span>
                        </button>
                    </div>
                ))}
                {items.length === 0 && <p className="text-[9px] text-slate-300 italic py-1">No items configured.</p>}
            </div>
        </div>
    );
}

// Composant Interne: Pro Social Matrix
function ProSocialMatrix({ value, onChange }: { value: any, onChange: (next: any) => void }) {
    const PLATFORMS = [
        { key: 'twitter', icon: '🐦', color: 'text-sky-500' },
        { key: 'bluesky', icon: '🦋', color: 'text-blue-400' },
        { key: 'mastodon', icon: '🐘', color: 'text-purple-500' },
        { key: 'discord', icon: '🔔', color: 'text-indigo-400' },
    ];
    const TYPES = ['🔴 ALERTE INFO', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'];

    const toggle = (type: string, platform: string) => {
        const next = { ...value };
        if (!next[type]) next[type] = {};
        next[type][platform] = !next[type][platform];
        onChange(next);
    };

    return (
        <div className="border border-slate-100 rounded-sm overflow-hidden shadow-sm">
            <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                        <th className="text-left p-2 text-[8px] font-black text-slate-400 uppercase tracking-tighter">Event Category</th>
                        {PLATFORMS.map(p => (
                            <th key={p.key} className="p-2 text-center" title={p.key.toUpperCase()}>
                                <span className={`text-[12px] ${p.color}`}>{p.icon}</span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {TYPES.map(type => (
                        <tr key={type} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-2 text-[9px] font-black text-slate-600">{type}</td>
                            {PLATFORMS.map(p => {
                                const active = value[type]?.[p.key];
                                return (
                                    <td key={p.key} className="p-1 text-center">
                                        <button 
                                            onClick={() => toggle(type, p.key)}
                                            className={`w-4 h-4 mx-auto rounded-sm border transition-all flex items-center justify-center ${active ? 'bg-black border-black' : 'bg-white border-slate-100'}`}
                                        >
                                            {active && <div className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,1)]" />}
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
