'use client';

import React, { useState, useEffect } from 'react';
import { useRadarAdmin } from './components/RadarAdminContext';
import { RadarCard } from './components/RadarCard';
import { BrutalSidePanels } from './components/BrutalSidePanels';

import { DashboardLayout } from './components/DashboardLayout';
import { ManualScanModal } from './components/ManualScanModal';
import { BulkActionBar } from './components/BulkActionBar';

export default function RadarAdminPage() {
    const { posts, loading, fetchQueue, updateStatus, isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'IGNORED'>('PENDING');
    const [geoFilter, setGeoFilter] = useState<'all' | 'france' | 'international'>('all');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal State
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);

    useEffect(() => {
        fetchQueue(activeTab, geoFilter);
    }, [activeTab, geoFilter]);

    useEffect(() => {
        const handler = () => setIsScanModalOpen(true);
        window.addEventListener('open-scan-modal', handler);
        return () => window.removeEventListener('open-scan-modal', handler);
    }, []);

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

    const handleLaunchScan = async (scanConfig: any) => {
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

            {/* Bulk Action Bar */}
            <BulkActionBar 
                selectedIds={selectedIds} 
                onStatusUpdate={handleBulkStatus} 
                onClearSelection={() => setSelectedIds([])} 
            />

            {/* Modal de Configuration Scan */}
            <ManualScanModal 
                isOpen={isScanModalOpen} 
                onClose={() => setIsScanModalOpen(false)} 
                onLaunch={handleLaunchScan} 
            />
        </DashboardLayout>
    );
}
