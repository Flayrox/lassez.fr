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
import { AdvancedSection } from './components/AdvancedSection';
import { motion, AnimatePresence } from 'framer-motion';

export default function SettingsPage() {
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'sources' | 'pipeline' | 'daemon' | 'diffusion' | 'health' | 'users' | 'advanced'>('sources');
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
        { key: 'pipeline', label: 'Cortex engine', icon: 'psychology' },
        { key: 'daemon', label: 'Daemon & schedule', icon: 'schedule' },
        { key: 'diffusion', label: 'Social matrix', icon: 'share' },
        { key: 'health', label: 'System health', icon: 'health_and_safety' },
        { key: 'users', label: 'Access control', icon: 'group' },
        { key: 'advanced', label: 'Advanced registry', icon: 'settings_input_component' },
    ];

    return (
        <ModernDashboardLayout 
            title="Settings" 
            subtitle="Cortex configuration" 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar */}
                <div className="lg:w-48 space-y-1">
                    <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-2">Configuration</p>
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-sm text-[11px] font-medium transition-all ${
                                activeTab === tab.key
                                    ? 'bg-black text-white'
                                    : 'text-slate-500 hover:text-black hover:bg-slate-50'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}

                    <div className="mt-6 pt-6 border-t border-slate-100 px-3 space-y-3">
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className={`w-full py-1.5 rounded-sm text-[11px] font-bold transition-all ${
                                isDirty 
                                    ? 'bg-black text-white hover:bg-zinc-800' 
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            {isSaving ? 'Saving...' : 'Save changes'}
                        </button>
                        {isDirty && (
                            <p className="text-[9px] text-amber-600 font-bold text-center italic">
                                Unsaved changes
                            </p>
                        )}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 min-h-[500px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.15 }}
                        >
                            {activeTab === 'sources' && <SourcesSection />}
                            {activeTab === 'pipeline' && <PipelineSection form={form} updateForm={updateForm} />}
                            {activeTab === 'daemon' && <DaemonSection form={form} updateForm={updateForm} />}
                            {activeTab === 'diffusion' && <DiffusionSection form={form} updateForm={updateForm} />}
                            { activeTab === 'health' && <HealthSection /> }
                            { activeTab === 'users' && <UserSection /> }
                            { activeTab === 'advanced' && <AdvancedSection form={form} updateForm={updateForm} /> }
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>
        </ModernDashboardLayout>
    );
}
