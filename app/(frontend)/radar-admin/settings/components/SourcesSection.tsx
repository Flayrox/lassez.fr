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
    lastScanned?: string;
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
        trust_score: 5
    });

    const fetchSources = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/radar/sources');
            const data = await res.json();
            if (data.success) setSources(data.sources);
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
            trust_score: source.trust_score || 5
        });
        setIsModalOpen(true);
    };

    const handleToggle = async (id: string, active: boolean) => {
        try {
            await fetch('/api/radar/sources', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, active })
            });
            setSources(prev => prev.map(s => s.id === id ? { ...s, active } : s));
        } catch (e) { console.error(e); }
    };

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
        <div className="space-y-12">
            {/* Header Vercel Style */}
            <div className="flex justify-between items-baseline border-b border-slate-200 pb-5">
                <div>
                    <h3 className="text-lg font-medium tracking-tight text-black">Source Matrix</h3>
                    <p className="text-sm text-slate-500">Configure acquisition vectors and editorial bias.</p>
                </div>
                <button 
                    onClick={() => {
                        setEditingSource(null);
                        setFormData({ source_name: '', url: '', type: 'RSS', source_bias: 'Centre', trust_score: 5 });
                        setIsModalOpen(true);
                    }}
                    className="bg-black text-white text-xs font-medium px-4 py-2 rounded-md hover:bg-slate-800 transition-colors"
                >
                    Add Source
                </button>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th 
                                className="py-4 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-black"
                                onClick={() => requestSort('source_name')}
                            >
                                Source {sortConfig?.key === 'source_name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                                className="py-4 text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:text-black"
                                onClick={() => requestSort('source_bias')}
                            >
                                Bias {sortConfig?.key === 'source_bias' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                                className="py-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-center w-32 cursor-pointer hover:text-black"
                                onClick={() => requestSort('trust_score')}
                            >
                                Trust {sortConfig?.key === 'trust_score' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-center w-24">Status</th>
                            <th className="py-4 text-xs font-medium text-slate-500 uppercase tracking-wider text-right w-20"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-400">Loading matrix...</td></tr>
                        ) : sortedSources.length === 0 ? (
                            <tr><td colSpan={5} className="py-12 text-center text-xs text-slate-400 font-mono italic">No sources configured.</td></tr>
                        ) : (
                            sortedSources.map(source => (
                                <tr key={source.id} className="group hover:bg-slate-50/50">
                                    <td className="py-5 cursor-pointer" onClick={() => handleEdit(source)}>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-sm font-medium text-black">{source.source_name}</span>
                                            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-tight">{source.type} — {source.url}</span>
                                        </div>
                                    </td>
                                    <td className="py-5">
                                        <span className="text-xs text-slate-600 font-medium bg-slate-100 px-2 py-1 rounded">
                                            {source.source_bias}
                                        </span>
                                    </td>
                                    <td className="py-5">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-24 h-[1px] bg-slate-200 relative overflow-hidden">
                                                <div 
                                                    className={`absolute top-0 left-0 h-full ${source.trust_score > 7 ? 'bg-black' : source.trust_score > 4 ? 'bg-slate-400' : 'bg-red-400'}`}
                                                    style={{ width: `${source.trust_score * 10}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono font-medium text-slate-400">{source.trust_score}/10</span>
                                        </div>
                                    </td>
                                    <td className="py-5">
                                        <div className="flex justify-center">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleToggle(source.id, !source.active);
                                                }}
                                                className={`w-8 h-4 rounded-full transition-colors relative border ${source.active ? 'bg-black border-black' : 'bg-white border-slate-200'}`}
                                            >
                                                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all ${source.active ? 'bg-white left-4.5' : 'bg-slate-200 left-0.5'}`} />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="py-5 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); if(confirm('Delete source?')) fetch(`/api/radar/sources?id=${source.id}`, { method: 'DELETE' }).then(fetchSources); }}
                                            className="text-slate-300 hover:text-red-500 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-lg">close</span>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal Vercel Style */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div 
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-white/80 backdrop-blur-md"
                            onClick={() => setIsModalOpen(false)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                            className="relative w-full max-w-lg bg-white border border-slate-200 shadow-2xl p-8 rounded-xl"
                        >
                            <div className="space-y-8">
                                <div className="border-b border-slate-100 pb-4">
                                    <h4 className="text-lg font-medium text-black">
                                        {editingSource ? 'Edit Intelligence Vector' : 'New Intelligence Vector'}
                                    </h4>
                                </div>

                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Platform</label>
                                            <select 
                                                value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}
                                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-black transition-colors"
                                            >
                                                <option value="RSS">RSS Feed</option>
                                                <option value="TELEGRAM">Telegram</option>
                                                <option value="TWITTER">Twitter/X (RSSHub)</option>
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Source Name</label>
                                            <input 
                                                value={formData.source_name} onChange={e => setFormData({...formData, source_name: e.target.value})}
                                                placeholder="e.g. Le Monde"
                                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-black transition-colors"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Endpoint URL / ID</label>
                                        <input 
                                            value={formData.url} onChange={e => setFormData({...formData, url: e.target.value})}
                                            placeholder="https://..."
                                            className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-black transition-colors"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Reliability Score (1-10)</label>
                                            <input 
                                                type="number" min="1" max="10"
                                                value={formData.trust_score} onChange={e => setFormData({...formData, trust_score: parseInt(e.target.value)})}
                                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-black transition-colors"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[11px] font-medium text-slate-500 uppercase tracking-widest">Editorial Bias</label>
                                            <select 
                                                value={formData.source_bias} onChange={e => setFormData({...formData, source_bias: e.target.value})}
                                                className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-black transition-colors"
                                            >
                                                {BIASES.map(b => <option key={b} value={b}>{b}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button 
                                        onClick={() => setIsModalOpen(false)}
                                        className="flex-1 py-2.5 text-xs font-medium text-slate-500 hover:text-black transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleSave}
                                        className="flex-1 py-2.5 bg-black text-white text-xs font-medium rounded-md hover:bg-slate-800 transition-colors"
                                    >
                                        {editingSource ? 'Update Source' : 'Confirm & Add'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
