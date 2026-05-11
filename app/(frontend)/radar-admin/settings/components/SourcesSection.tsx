'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Source {
    id: string;
    source_name: string;
    url: string;
    type: string;
    active: boolean;
    source_bias: string;
    trust_score: number;
    allowSourceImages: boolean;
    health?: {
        status: 'HEALTHY' | 'DEGRADED' | 'DISABLED';
        consecutive_failures: number;
        last_error?: string;
    };
}

type SortConfig = { key: keyof Source; direction: 'asc' | 'desc' } | null;

const BIASES = [
    "Extrême-Gauche", "Gauche", "Centre-Gauche", "Centre", 
    "Centre-Droite", "Droite", "Extrême-Droite", "Service Public", "Indépendant"
];

export function SourcesSection() {
    const [sources, setSources] = useState<Source[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSource, setEditingSource] = useState<Source | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'source_name', direction: 'asc' });
    
    const [formData, setFormData] = useState({
        source_name: '',
        url: '',
        type: 'RSS',
        source_bias: 'Centre',
        trust_score: 5,
        allowSourceImages: true
    });

    const [healthData, setHealthData] = useState<any[]>([]);

    const fetchSources = async () => {
        setLoading(true);
        try {
            const [sourcesRes, healthRes] = await Promise.all([
                fetch('/api/radar/sources'),
                fetch('/api/radar/sources/health')
            ]);
            
            const sData = await sourcesRes.json();
            const hData = await healthRes.json();
            
            if (sData.success) {
                const combined = sData.sources.map((s: Source) => ({
                    ...s,
                    health: hData.success ? hData.health.find((h: any) => h.url === s.url) : undefined
                }));
                setSources(combined);
            }
            if (hData.success) setHealthData(hData.health);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchSources();
    }, []);

    const handleSave = async () => {
        if (!formData.source_name || !formData.url) return;
        const method = editingSource ? 'PATCH' : 'POST';
        const payload = editingSource ? { id: editingSource.id, ...formData } : formData;

        try {
            const res = await fetch('/api/radar/sources', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setIsModalOpen(false);
                setEditingSource(null);
                fetchSources();
            }
        } catch (e) { console.error(e); }
    };

    const handleEdit = (source: Source) => {
        setEditingSource(source);
        setFormData({
            source_name: source.source_name,
            url: source.url,
            type: source.type,
            source_bias: source.source_bias || 'Centre',
            trust_score: source.trust_score || 5,
            allowSourceImages: source.allowSourceImages !== undefined ? source.allowSourceImages : true
        });
        setIsModalOpen(true);
    };

    const handleToggleActive = async (id: string, active: boolean) => {
        try {
            await fetch('/api/radar/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, active })
            });
            setSources(prev => prev.map(s => s.id === id ? { ...s, active } : s));
        } catch (e) { console.error(e); }
    };

    const handleToggleImages = async (id: string, allowSourceImages: boolean) => {
        try {
            await fetch('/api/radar/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, allowSourceImages })
            });
            setSources(prev => prev.map(s => s.id === id ? { ...s, allowSourceImages } : s));
        } catch (e) { console.error(e); }
    };

    const handleResetHealth = async (url: string) => {
        try {
            const res = await fetch('/api/radar/sources/health', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            if (res.ok) fetchSources();
        } catch (e) { console.error(e); }
    };

    const quarantinedSources = useMemo(() => {
        return sources.filter(s => s.health && s.health.status !== 'HEALTHY');
    }, [sources]);

    const sortedSources = useMemo(() => {
        if (!sortConfig) return sources;
        return [...sources].sort((a, b) => {
            const aVal = a[sortConfig.key];
            const bVal = b[sortConfig.key];
            if (aVal === undefined || bVal === undefined) return 0;
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [sources, sortConfig]);

    const requestSort = (key: keyof Source) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-black">Acquisition vectors</h3>
                    <span className="text-[10px] text-slate-400 font-mono">({sources.length})</span>
                </div>
                <button 
                    onClick={() => {
                        setEditingSource(null);
                        setFormData({ source_name: '', url: '', type: 'RSS', source_bias: 'Centre', trust_score: 5, allowSourceImages: true });
                        setIsModalOpen(true);
                    }}
                    className="bg-black text-white text-[11px] font-bold px-3 py-1 rounded-sm hover:bg-zinc-800 transition-all shadow-sm"
                >
                    Add new source
                </button>
            </div>

            <div className="border border-slate-200 rounded-sm overflow-hidden bg-white shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="w-[30%] px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter cursor-pointer hover:text-black" onClick={() => requestSort('source_name')}>
                                Source {sortConfig?.key === 'source_name' && (sortConfig.direction === 'asc' ? '↓' : '↑')}
                            </th>
                            <th className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                Endpoint
                            </th>
                            <th className="w-24 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center">
                                Trust / Images
                            </th>
                            <th className="w-16 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center">Status</th>
                            <th className="w-20 px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-tighter text-center">Health</th>
                            <th className="w-10 px-4 py-2"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {loading ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400 animate-pulse">Scanning matrix...</td></tr>
                        ) : sortedSources.length === 0 ? (
                            <tr><td colSpan={5} className="py-8 text-center text-slate-400 italic">No vectors configured.</td></tr>
                        ) : (
                            sortedSources.map(source => (
                                <tr key={source.id} className="group hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-2 cursor-pointer" onClick={() => handleEdit(source)}>
                                        <div className="font-bold text-black">{source.source_name}</div>
                                        <div className="text-[10px] text-slate-400 font-normal">{source.source_bias}</div>
                                    </td>
                                    <td className="px-4 py-2 truncate text-slate-500 max-w-0">
                                        {source.url}
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="font-bold">{source.trust_score}/10</span>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleToggleImages(source.id, !source.allowSourceImages); }}
                                                className={`text-[9px] px-1.5 py-0.5 rounded-sm border ${source.allowSourceImages ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-slate-200 text-slate-400 bg-slate-50'}`}
                                            >
                                                {source.allowSourceImages ? 'IMG ON' : 'IMG OFF'}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-center">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleToggleActive(source.id, !source.active); }}
                                                className={`w-6 h-3.5 rounded-full relative transition-all ${source.active ? 'bg-black' : 'bg-slate-200'}`}
                                            >
                                                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${source.active ? 'left-3' : 'left-0.5'}`} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex justify-center">
                                            {source.health ? (
                                                <div className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold border ${
                                                    source.health.status === 'HEALTHY' ? 'border-emerald-200 text-emerald-600 bg-emerald-50' :
                                                    source.health.status === 'DEGRADED' ? 'border-amber-200 text-amber-600 bg-amber-50' :
                                                    'border-red-200 text-red-600 bg-red-50'
                                                }`}>
                                                    {source.health.status}
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-slate-300">--</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-right">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(confirm('Purge vector?')) fetch(`/api/radar/sources?id=${source.id}`, { method: 'DELETE' }).then(fetchSources); }}
                                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">close</span>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-white/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="relative w-full max-w-sm bg-white border border-slate-200 shadow-xl rounded-sm p-6">
                            <h4 className="text-xs font-bold text-black mb-6 border-b border-slate-100 pb-2 uppercase tracking-tighter">{editingSource ? 'Reconfigure Vector' : 'Register New Vector'}</h4>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Source Label</label>
                                    <input value={formData.source_name} onChange={e => setFormData({...formData, source_name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] outline-none focus:border-black transition-all" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Endpoint / ID</label>
                                    <input value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] font-mono outline-none focus:border-black transition-all" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Protocol</label>
                                        <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] outline-none focus:border-black transition-all">
                                            <option value="RSS">RSS</option>
                                            <option value="TELEGRAM">Telegram</option>
                                            <option value="TWITTER">Twitter</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Trust Score</label>
                                        <input type="number" min="1" max="10" value={formData.trust_score} onChange={e => setFormData({...formData, trust_score: parseInt(e.target.value)})} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] outline-none focus:border-black transition-all" />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Ideological Bias</label>
                                    <select value={formData.source_bias} onChange={e => setFormData({...formData, source_bias: e.target.value})} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1.5 text-[11px] outline-none focus:border-black transition-all">
                                        {BIASES.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>

                                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-sm border border-slate-100">
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-bold text-black uppercase tracking-tighter">Allow Source Images</span>
                                        <span className="text-[9px] text-slate-400">Enable automatic image extraction</span>
                                    </div>
                                    <button 
                                        onClick={() => setFormData({...formData, allowSourceImages: !formData.allowSourceImages})}
                                        className={`w-8 h-4.5 rounded-full relative transition-all ${formData.allowSourceImages ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${formData.allowSourceImages ? 'left-4' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex gap-2 mt-8">
                                <button onClick={() => setIsModalOpen(false)} className="flex-1 py-1.5 text-[11px] font-bold text-slate-400 hover:text-black transition-all">CANCEL</button>
                                <button onClick={handleSave} className="flex-1 py-1.5 bg-black text-white text-[11px] font-bold rounded-sm hover:bg-zinc-800 transition-all">SYNCHRONIZE</button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
