'use client';

import React, { useState, useEffect } from 'react';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { ModernDashboardLayout } from '../components/ModernDashboardLayout';
import { SourcesSection } from './components/SourcesSection';
import { PipelineSection } from './components/PipelineSection';
import { DaemonSection } from './components/DaemonSection';
import { DiffusionSection } from './components/DiffusionSection';
import { HealthSection } from './components/HealthSection';
import { UserSection } from './components/UserSection';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsPage() {
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'sources' | 'pipeline' | 'daemon' | 'diffusion' | 'health' | 'users'>('sources');
    const [form, setForm] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    useEffect(() => {
        if (settings) {
            setForm({ ...settings });
            setIsDirty(false);
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            await fetchSettings();
            setIsDirty(false);
        } catch (e) { 
            console.error(e); 
            alert('Failed to save settings.');
        } finally { 
            setIsSaving(false); 
        }
    };

    const updateForm = (key: string, val: any) => {
        setForm((prev: any) => ({ ...prev, [key]: val }));
        setIsDirty(true);
    };

    const tabs = [
        { key: 'sources', label: 'Sources', icon: 'rss_feed' },
        { key: 'pipeline', label: 'Cortex Engine', icon: 'psychology' },
        { key: 'daemon', label: 'Daemon & Schedule', icon: 'schedule' },
        { key: 'diffusion', label: 'Social Matrix', icon: 'share' },
        { key: 'health', label: 'System Health', icon: 'health_and_safety' },
        { key: 'users', label: 'Access Control', icon: 'group' },
    ];

    return (
        <ModernDashboardLayout 
            title="Settings" 
            subtitle="Cortex Global Configuration" 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="flex flex-col lg:flex-row gap-12">
                {/* Internal Sidebar Tabs */}
                <div className="lg:w-64 space-y-2">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-tight transition-all ${
                                activeTab === tab.key
                                    ? 'bg-black text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}

                    <div className="mt-8 pt-8 border-t border-slate-100 space-y-4">
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className={`w-full py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                                isDirty 
                                    ? 'bg-emerald-500 text-white shadow-md hover:bg-emerald-600' 
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                        {isDirty && (
                            <p className="text-[10px] text-amber-600 font-bold text-center uppercase tracking-tight animate-pulse">
                                Unsaved changes detected
                            </p>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm min-h-[600px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -10 }}
                            transition={{ duration: 0.2 }}
                        >
                            {activeTab === 'sources' && <SourcesSection form={form} updateForm={updateForm} />}
                            {activeTab === 'pipeline' && <PipelineSection form={form} updateForm={updateForm} />}
                            {activeTab === 'daemon' && <DaemonSection form={form} updateForm={updateForm} />}
                            {activeTab === 'diffusion' && <DiffusionSection form={form} updateForm={updateForm} />}
                            {activeTab === 'health' && <HealthSection form={form} updateForm={updateForm} />}
                            {activeTab === 'users' && <UserSection />}
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </ModernDashboardLayout>
    );
}
