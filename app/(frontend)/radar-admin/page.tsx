'use client';

import React, { useState, useEffect } from 'react';
import { useRadarAdmin } from './components/RadarAdminContext';
import { ModernRadarCard } from './components/ModernRadarCard';
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
        { key: 'LAB', label: 'Cortex Lab', icon: 'psychology' },
        { key: 'REVIEW', label: 'To Review', icon: 'visibility' },
        { key: 'QUEUE', label: 'Scheduled', icon: 'schedule' },
        { key: 'DONE', label: 'Published', icon: 'check_circle' },
        { key: 'TRASH', label: 'Rejected', icon: 'delete' },
    ];

    const filteredPosts = posts.filter((post: any) => {
        if (!searchTerm.trim()) return true;
        const haystack = `${post.source_title || ''} ${post.flash_content || ''} ${post.tags || ''}`.toLowerCase();
        return haystack.includes(searchTerm.toLowerCase());
    });

    return (
        <ModernDashboardLayout 
            title="Overview" 
            subtitle={countdown || "Syncing OSINT signals..."} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="space-y-6">
                {/* Search & Global Actions */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative flex-1 w-full max-w-md">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input 
                            type="text" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search signals..." 
                            className="w-full bg-white border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-100 transition-all"
                        />
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            {(['all', 'france', 'international'] as const).map(key => (
                                <button
                                    key={key}
                                    onClick={() => setGeoFilter(key)}
                                    className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all ${
                                        geoFilter === key 
                                            ? 'bg-white text-slate-900 shadow-sm' 
                                            : 'text-slate-500 hover:text-slate-700'
                                    }`}
                                >
                                    {key === 'all' ? 'Global' : key}
                                </button>
                            ))}
                        </div>
                        
                        <button 
                            onClick={() => setIsScanModalOpen(true)}
                            className="bg-black text-white h-9 px-4 rounded-lg font-bold text-xs uppercase tracking-tight hover:bg-slate-800 transition-all shadow-sm flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">sync</span>
                            New Scan
                        </button>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className="flex items-center gap-1 border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-4 py-3 text-xs font-bold uppercase tracking-tight transition-all relative ${
                                activeTab === tab.key 
                                    ? 'text-slate-900' 
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined text-sm ${activeTab === tab.key ? 'text-black' : 'text-slate-300'}`}>
                                    {tab.icon}
                                </span>
                                {tab.label}
                            </div>
                            {activeTab === tab.key && (
                                <motion.div 
                                    layoutId="activeTab"
                                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-black" 
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Feed Items */}
                <div className="space-y-4">
                    {loading ? (
                        <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
                            <p className="text-[10px] font-bold uppercase tracking-widest">Syncing signals...</p>
                        </div>
                    ) : filteredPosts.length === 0 ? (
                        <div className="py-20 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                            <span className="material-symbols-outlined text-slate-200 text-5xl mb-4">inventory_2</span>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">No signals found</p>
                            <button 
                                onClick={() => setIsScanModalOpen(true)} 
                                className="mt-4 px-6 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                Trigger New Scan
                            </button>
                        </div>
                    ) : (
                        <div className="grid gap-4">
                            <AnimatePresence mode="popLayout">
                                {filteredPosts.map(post => (
                                    <ModernRadarCard 
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
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
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
        </ModernDashboardLayout>
    );
}
