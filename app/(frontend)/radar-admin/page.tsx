'use client';

import React, { useState, useEffect } from 'react';
import { useRadarAdmin } from './components/RadarAdminContext';
import { RadarCard } from './components/RadarCard';
import { BrutalSidePanels } from './components/BrutalSidePanels';

import { DashboardLayout } from './components/DashboardLayout';

export default function RadarAdminPage() {
    const { posts, loading, fetchQueue, updateStatus, isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'IGNORED'>('PENDING');
    const [geoFilter, setGeoFilter] = useState<'all' | 'france' | 'international'>('all');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);
    const [scanConfig, setScanConfig] = useState({
        model: 'gemini-3.1-pro-preview',
        types: ['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'],
        count: 10,
        prompt: '',
        saveDb: true
    });

    useEffect(() => {
        fetchQueue(activeTab, geoFilter);
    }, [activeTab, geoFilter]);

    const handleBulkStatus = async (status: string) => {
        if (!confirm(`Appliquer "${status}" à ${selectedIds.length} signal(s) ?`)) return;
        try {
            await fetch('/api/radar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, status })
            });
            fetchQueue(activeTab, geoFilter);
            setSelectedIds([]);
        } catch (e) { console.error(e); }
    };

    const handleLaunchScan = async () => {
        try {
            await fetch('/api/radar/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'scan',
                    customScan: scanConfig
                })
            });
            setIsScanModalOpen(false);
            fetchQueue(activeTab, geoFilter);
        } catch (e) { console.error(e); }
    };

    const tabs = [
        { key: 'PENDING', label: 'En attente', icon: 'bolt' },
        { key: 'APPROVED', label: 'Approuvés', icon: 'schedule' },
        { key: 'PUBLISHED', label: 'Publiés', icon: 'check_circle' },
        { key: 'REJECTED', label: 'Rejetés', icon: 'delete' },
        { key: 'IGNORED', label: 'Archivés', icon: 'inventory_2' },
    ];

    const filteredPosts = posts.filter((post: any) => {
        if (!searchTerm.trim()) return true;
        const haystack = `${post.source_title || ''} ${post.flash_content || ''} ${post.tags || ''}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
    });

    return (
        <DashboardLayout 
            title="RADAR L'ASSEZ" 
            subtitle={countdown || "Synchronisation des signaux OSINT..."} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="flex gap-8">
            <div className="flex-1 space-y-8">
                {/* Search & Filters */}
                <section className="bg-white border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] p-6 flex flex-col md:flex-row gap-6 items-center">
                    <div className="flex-1 relative w-full">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-stone-400">search</span>
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="FILTRER LES SIGNAUX..." 
                            className="w-full bg-stone-100 border-4 border-stone-900 py-3 pl-12 pr-4 font-black uppercase text-xs tracking-widest focus:outline-none focus:bg-white transition-all"
                        />
                    </div>
                    <div className="flex border-4 border-stone-900 bg-stone-100 font-bold uppercase text-[10px] tracking-widest overflow-hidden">
                        {(['all', 'france', 'international'] as const).map(key => (
                            <button
                                key={key}
                                onClick={() => setGeoFilter(key)}
                                className={`px-6 py-3 border-r-4 last:border-r-0 border-stone-900 transition-all ${geoFilter === key ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-white'}`}
                            >
                                {key === 'all' ? 'GLOBAL' : key === 'france' ? 'FRANCE' : 'INTL'}
                            </button>
                        ))}
                    </div>
                    
                    <button 
                        onClick={() => setIsScanModalOpen(true)}
                        className="bg-red-700 text-white px-6 py-3 border-4 border-stone-900 font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-colors shadow-[4px_4px_0px_0px_#1A1C1C]"
                    >
                        Lancer un scan
                    </button>
                </section>

                {/* Sub-Navigation Tabs */}
                <nav className="flex gap-4 border-b-4 border-stone-200 pb-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-6 py-3 font-black uppercase text-xs tracking-widest transition-all relative ${
                                activeTab === tab.key 
                                    ? 'text-stone-900' 
                                    : 'text-stone-400 hover:text-stone-600'
                            }`}
                        >
                            <span className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                                {tab.label}
                            </span>
                            {activeTab === tab.key && (
                                <div className="absolute bottom-[-4px] left-0 right-0 h-1 bg-red-700" />
                            )}
                        </button>
                    ))}
                </nav>

                {/* Feed Items */}
                <div className="space-y-6">
                    {loading ? (
                        <div className="py-20 text-center font-black uppercase tracking-[0.3em] text-stone-300 animate-pulse">Synchronisation...</div>
                    ) : filteredPosts.length === 0 ? (
                        <div className="py-20 text-center border-4 border-dashed border-stone-200 bg-stone-50">
                            <p className="text-xl font-headline font-black text-stone-300 italic uppercase">Aucun signal trouvé</p>
                            <button onClick={() => setIsScanModalOpen(true)} className="mt-6 bg-stone-900 text-white px-8 py-3 font-bold uppercase text-xs tracking-widest border-4 border-stone-900 shadow-[4px_4px_0px_0px_rgba(26,28,28,0.3)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">Configurer un scan</button>
                        </div>
                    ) : (
                        filteredPosts.map(post => (
                            <RadarCard 
                                key={post.id} 
                                post={post as any} 
                                onUpdate={updateStatus as any} 
                                activeTab={activeTab}
                                isSelected={selectedIds.includes(post.id)}
                                onToggleSelect={(id, sel) => {
                                    if (sel) setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
                                    else setSelectedIds(prev => prev.filter(i => i !== id));
                                }}
                            />
                        ))
                    )}
                </div>
            </div>

            {/* Side Panels */}
            <BrutalSidePanels />
            </div>

            {/* Modal de Configuration Scan */}
            {isScanModalOpen && (
                <div className="fixed inset-0 bg-stone-900/80 z-[200] flex items-center justify-center p-4">
                    <div className="bg-stone-50 border-4 border-stone-900 w-full max-w-2xl shadow-[8px_8px_0px_0px_#1A1C1C] flex flex-col max-h-[90vh]">
                        <div className="bg-stone-900 text-white p-4 flex justify-between items-center">
                            <h2 className="font-black uppercase tracking-widest text-lg font-headline">Configurer le Scan</h2>
                            <button onClick={() => setIsScanModalOpen(false)} className="material-symbols-outlined hover:text-red-500">close</button>
                        </div>
                        
                        <div className="p-6 space-y-6 overflow-y-auto font-label">
                            {/* Modèle */}
                            <div className="flex flex-col gap-2">
                                <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Modèle IA</label>
                                <select 
                                    value={scanConfig.model}
                                    onChange={e => setScanConfig({...scanConfig, model: e.target.value})}
                                    className="border-4 border-stone-900 bg-white p-3 font-bold uppercase text-xs focus:outline-none"
                                >
                                    <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                                    <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                                    <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                                </select>
                            </div>

                            {/* Types d'info */}
                            <div className="flex flex-col gap-2">
                                <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Type d&apos;info autorisé</label>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'].map(type => (
                                        <label key={type} className="flex items-center gap-3 border-4 border-stone-200 p-3 hover:border-stone-900 cursor-pointer transition-colors bg-white">
                                            <input 
                                                type="checkbox" 
                                                checked={scanConfig.types.includes(type)}
                                                onChange={e => {
                                                    const newTypes = e.target.checked 
                                                        ? [...scanConfig.types, type]
                                                        : scanConfig.types.filter(t => t !== type);
                                                    setScanConfig({...scanConfig, types: newTypes});
                                                }}
                                                className="w-5 h-5 accent-red-700" 
                                            />
                                            <span className="font-bold text-[10px] uppercase">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Nombre d'articles */}
                            <div className="flex flex-col gap-2">
                                <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Nombre d&apos;articles (Max)</label>
                                <input 
                                    type="number" 
                                    min="1" max="40"
                                    value={scanConfig.count}
                                    onChange={e => setScanConfig({...scanConfig, count: parseInt(e.target.value) || 10})}
                                    className="border-4 border-stone-900 p-3 font-bold text-xs w-full focus:outline-none"
                                />
                            </div>

                            {/* Prompt Modifié */}
                            <div className="flex flex-col gap-2">
                                <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Prompt Modifié (Optionnel)</label>
                                <textarea 
                                    rows={4}
                                    value={scanConfig.prompt}
                                    onChange={e => setScanConfig({...scanConfig, prompt: e.target.value})}
                                    placeholder="Surchargez ici le prompt standard..."
                                    className="border-4 border-stone-900 p-3 text-xs w-full resize-y focus:outline-none font-mono"
                                />
                            </div>

                            {/* Sauvegarder en BDD */}
                            <label className="flex items-center gap-4 border-4 border-stone-900 p-4 bg-stone-100 cursor-pointer hover:bg-stone-200 transition-colors">
                                <input 
                                    type="checkbox" 
                                    checked={scanConfig.saveDb}
                                    onChange={e => setScanConfig({...scanConfig, saveDb: e.target.checked})}
                                    className="w-6 h-6 accent-red-700"
                                />
                                <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-stone-900">
                                    Sauvegarder en BDD (Sinon test Discord unique)
                                </span>
                            </label>
                        </div>
                        
                        <div className="p-4 bg-stone-200 border-t-4 border-stone-900 flex justify-end gap-4 mt-auto">
                            <button 
                                onClick={() => setIsScanModalOpen(false)}
                                className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-stone-600 hover:text-stone-900 transition-colors"
                            >
                                Annuler
                            </button>
                            <button 
                                onClick={handleLaunchScan}
                                className="bg-red-700 text-white px-8 py-3 font-black uppercase text-xs tracking-widest border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                            >
                                Lancer le Scan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-stone-900 text-white p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(26,28,28,0.3)] z-[100] flex items-center gap-8 animate-in slide-in-from-bottom-10">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-red-700 flex items-center justify-center font-black text-xl brutal-border border-white/20">
                            {selectedIds.length}
                        </div>
                        <div className="font-black uppercase text-[10px] tracking-widest text-stone-400">Signaux sélectionnés</div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => handleBulkStatus('APPROVED')} className="px-6 py-2 bg-stone-800 border-2 border-stone-700 font-bold uppercase text-[10px] tracking-widest hover:border-white transition-all">Approuver</button>
                        <button onClick={() => handleBulkStatus('REJECTED')} className="px-6 py-2 bg-stone-800 border-2 border-stone-700 font-bold uppercase text-[10px] tracking-widest hover:border-red-700 transition-all">Rejeter</button>
                        <button onClick={() => handleBulkStatus('PUBLISHED')} className="px-8 py-2 bg-red-700 border-2 border-red-600 font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all">Publier 🚀</button>
                        <button onClick={() => setSelectedIds([])} className="ml-4 material-symbols-outlined text-stone-500 hover:text-white transition-colors">close</button>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
