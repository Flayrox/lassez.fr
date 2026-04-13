'use client';

import React, { useState } from 'react';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { DashboardLayout } from '../components/DashboardLayout';
import { ConsoleTab } from '../components/ConsoleTab';
import { TestIATab } from '../components/TestIATab';

export default function LabPage() {
    const { isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'CONSOLE' | 'TEST_IA'>('CONSOLE');

    return (
        <DashboardLayout 
            title="LABORATOIRE" 
            subtitle={countdown || "Diagnostics système et tests IA..."} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="max-w-6xl space-y-8 font-label">
                <header className="flex justify-between items-end border-b-4 border-stone-200 pb-6">
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter font-headline mb-2">Laboratoire</h2>
                        <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Extraction de signaux et ingénierie de prompts IA</p>
                    </div>
                    <nav className="flex gap-4">
                        <button
                            onClick={() => setActiveTab('CONSOLE')}
                            className={`px-6 py-2 font-black uppercase text-[10px] tracking-widest border-4 transition-all ${
                                activeTab === 'CONSOLE' 
                                    ? 'bg-stone-900 text-white border-stone-900 shadow-[4px_4px_0px_0px_#bc0100]' 
                                    : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400'
                            }`}
                        >
                            Console daemon
                        </button>
                        <button
                            onClick={() => setActiveTab('TEST_IA')}
                            className={`px-6 py-2 font-black uppercase text-[10px] tracking-widest border-4 transition-all ${
                                activeTab === 'TEST_IA' 
                                    ? 'bg-stone-900 text-white border-stone-900 shadow-[4px_4px_0px_0px_#bc0100]' 
                                    : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400'
                            }`}
                        >
                            Test Cortex IA
                        </button>
                    </nav>
                </header>

                <div className="bg-white border-4 border-stone-900 shadow-[8px_8px_0px_0px_#1A1C1C] overflow-hidden min-h-[600px]">
                    {activeTab === 'CONSOLE' ? <ConsoleTab /> : <TestIATab />}
                </div>

                <footer className="bg-stone-900 text-stone-500 p-4 font-mono text-[10px] uppercase tracking-widest flex items-center gap-4">
                    <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                    Environnement Lab actif // Prêt pour exécution
                </footer>
            </div>
        </DashboardLayout>
    );
}
