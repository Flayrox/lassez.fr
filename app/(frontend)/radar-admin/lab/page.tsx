'use client';

import React, { useState } from 'react';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { ModernDashboardLayout } from '../components/ModernDashboardLayout';
import { ConsoleTab } from '../components/ConsoleTab';
import { TestIATab } from '../components/TestIATab';
import { motion, AnimatePresence } from 'framer-motion';

export default function LabPage() {
    const { isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'CONSOLE' | 'TEST_IA'>('CONSOLE');

    const tabs = [
        { key: 'CONSOLE', label: 'Daemon console', icon: 'terminal' },
        { key: 'TEST_IA', label: 'Cortex IA testing', icon: 'psychology_alt' },
    ];

    return (
        <ModernDashboardLayout 
            title="Laboratory" 
            subtitle={countdown || "System diagnostics & AI prototyping"} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="space-y-6">
                <div className="flex items-center gap-1 border-b border-slate-200">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-4 py-2 text-[11px] font-semibold transition-all relative ${
                                activeTab === tab.key 
                                    ? 'text-black' 
                                    : 'text-slate-400 hover:text-black'
                            }`}
                        >
                            <div className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                                {tab.label}
                            </div>
                            {activeTab === tab.key && (
                                <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-black" />
                            )}
                        </button>
                    ))}
                </div>

                <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden min-h-[500px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                            className="p-1"
                        >
                            {activeTab === 'CONSOLE' ? <ConsoleTab /> : <TestIATab />}
                        </motion.div>
                    </AnimatePresence>
                </div>

                <footer className="bg-slate-50 border border-slate-200 p-2 rounded-sm flex items-center gap-3">
                    <div className="flex items-center gap-1.5 ml-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] animate-pulse" />
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-tighter">Lab environment active</span>
                    </div>
                    <div className="h-3 w-px bg-slate-200" />
                    <span className="text-[10px] text-slate-400 font-medium italic">Ready for neural execution</span>
                </footer>
            </div>
        </ModernDashboardLayout>
    );
}
