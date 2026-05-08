'use client';

import React, { useState, useEffect } from 'react';
import { useRadarAdmin } from './components/RadarAdminContext';
import { ModernRadarTable } from './components/ModernRadarTable';
import { ModernDashboardLayout } from './components/ModernDashboardLayout';
import { ManualScanModal } from './components/ManualScanModal';
import { BulkActionBar } from './components/BulkActionBar';
import { motion, AnimatePresence } from 'framer-motion';

export default function RadarAdminPage() {
    const { posts, loading, fetchQueue, updateStatus, isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'LAB' | 'REVIEW' | 'QUEUE' | 'DONE' | 'TRASH'>('REVIEW');
    const [geoFilter, setGeoFilter] = useState<'all' | 'france' | 'international'>('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isScanModalOpen, setIsScanModalOpen] = useState(false);

    useEffect(() => {
        fetchQueue(activeTab, geoFilter);
    }, [activeTab, geoFilter]);

    const handleBulkStatus = async (status: string) => {
        if (!confirm(`Apply "${status}" to ${selectedIds.length} items?`)) return;
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
                body: JSON.stringify({ action: 'scan', customScan: scanConfig })
            });
            setIsScanModalOpen(false);
            fetchQueue(activeTab, geoFilter);
        } catch (e) { console.error(e); }
    };

    const tabs = [
        { key: 'LAB', label: 'Cortex lab', icon: 'psychology' },
        { key: 'REVIEW', label: 'To review', icon: 'visibility' },
        { key: 'QUEUE', label: 'Scheduled', icon: 'schedule' },
        { key: 'DONE', label: 'Published', icon: 'check_circle' },
        { key: 'TRASH', label: 'Rejected', icon: 'delete' },
    ];

    const filteredPosts = posts.filter((post: any) => {
        if (!searchTerm.trim()) return true;
        const haystack = `${post.source_title || ''} ${post.flash_content || ''} ${post.tags || ''}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
    });

    const handleToggleAll = (selected: boolean) => {
        if (selected) setSelectedIds(filteredPosts.map(p => p.id));
        else setSelectedIds([]);
    };

    const handleToggleSelect = (id: string, selected: boolean) => {
        if (selected) setSelectedIds(prev => [...prev, id]);
        else setSelectedIds(prev => prev.filter(i => i !== id));
    };

    return (
        <ModernDashboardLayout 
            title="Signals" 
            subtitle={countdown || "Monitoring global OSINT feed"} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="space-y-4">
                {/* Search & Global Actions */}
                <div className="flex flex-col md:flex-row gap-2 items-center justify-between bg-white p-2 rounded-sm border border-slate-200">
                    <div className="relative flex-1 w-full max-w-sm">
                        <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[14px]">search</span>
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Find signals..." 
                            className="w-full bg-slate-50 border-none rounded-sm py-1 pl-8 pr-3 text-[11px] font-medium outline-none focus:bg-white transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 p-0.5 rounded-sm border border-slate-200">
                            {(['all', 'france', 'international'] as const).map(key => (
                                <button
                                    key={key}
                                    onClick={() => setGeoFilter(key)}
                                    className={`px-3 py-1 rounded-sm text-[9px] font-bold transition-all ${
                                        geoFilter === key 
                                            ? 'bg-white text-black shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {key === 'all' ? 'Global' : key}
                                </button>
                            ))}
                        </div>
                        
                        <button 
                            onClick={() => setIsScanModalOpen(true)}
                            className="bg-black text-white h-7 px-3 rounded-sm font-bold text-[10px] hover:bg-zinc-800 transition-all flex items-center gap-1.5"
                        >
                            <span className="material-symbols-outlined text-[14px]">sync</span>
                            New scan
                        </button>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-4 py-2 text-[11px] font-semibold transition-all relative ${
                                activeTab === tab.key 
                                    ? 'text-black' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className={`material-symbols-outlined text-[16px] ${activeTab === tab.key ? 'text-black' : 'text-slate-300'}`}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                            </div>
                            {activeTab === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-black" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Table View */}
                <ModernRadarTable 
                    posts={filteredPosts}
                    loading={loading}
                    onUpdate={updateStatus as any}
                    activeTab={activeTab}
                    selectedIds={selectedIds}
                    onToggleSelect={handleToggleSelect}
                    onToggleAll={handleToggleAll}
                />
            </div>

            {/* Bulk Action Bar */}
            <BulkActionBar 
                selectedIds={selectedIds} 
                onStatusUpdate={handleBulkStatus} 
                onClearSelection={() => setSelectedIds([])} 
            />

            {/* Scan Modal */}
            <ManualScanModal 
                isOpen={isScanModalOpen} 
                onClose={() => setIsScanModalOpen(false)} 
                onLaunch={handleLaunchScan} 
            />
        </ModernDashboardLayout>
    );
}
