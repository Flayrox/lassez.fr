'use client';

import React from 'react';
import { useRadarAdmin } from './RadarAdminContext';

export function BrutalSidePanels() {
    const { settings, fetchSettings } = useRadarAdmin();

    const toggleDaemon = async (key: string, value: boolean) => {
        try {
            await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: value })
            });
            fetchSettings();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="w-80 flex flex-col gap-8 sticky top-32 h-fit font-label">
            {/* Daemon Status */}
            <section className="bg-white border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] p-6">
                <h3 className="text-lg font-black uppercase tracking-tighter mb-6 flex items-center gap-2 font-headline">
                    <span className="material-symbols-outlined text-red-700">settings_suggest</span>
                    Daemon Status
                </h3>
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-stone-600">RSS Scraper</span>
                        <Toggle 
                            checked={settings?.daemon_rss_enabled === 'true'} 
                            onChange={(v) => toggleDaemon('daemon_rss_enabled', v)} 
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-stone-600">Elections Tracker</span>
                        <Toggle 
                            checked={settings?.daemon_elections_enabled === 'true'} 
                            onChange={(v) => toggleDaemon('daemon_elections_enabled', v)} 
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-stone-600">Auto Pilot</span>
                        <Toggle 
                            checked={settings?.auto_pilot_enabled === 'true'} 
                            onChange={(v) => toggleDaemon('auto_pilot_enabled', v)} 
                        />
                    </div>
                </div>
            </section>

            {/* Network Density */}
            <section className="bg-white border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] p-6">
                <h3 className="text-lg font-black uppercase tracking-tighter mb-4 font-headline">Network Density</h3>
                <div className="h-32 bg-stone-100 border-2 border-stone-900 flex items-end p-2 gap-1 overflow-hidden">
                    {[40, 70, 45, 90, 65, 80, 30, 50, 85, 40, 60, 75, 55, 95, 45].map((h, i) => (
                        <div 
                            key={i} 
                            className="flex-1 bg-red-700 border border-stone-900" 
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
                <div className="mt-4 flex justify-between text-[10px] font-bold text-stone-500 uppercase">
                    <span>00:00</span>
                    <span className="text-red-700">Peak Load</span>
                    <span>12:00</span>
                </div>
            </section>

            {/* Hot Sources */}
            <section className="bg-white border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] p-6">
                <h3 className="text-lg font-black uppercase tracking-tighter mb-4 font-headline">Hot Sources</h3>
                <div className="space-y-3">
                    {[
                        { name: 'AFP_OFFICIAL', hits: 142 },
                        { name: 'REUTERS_INTL', hits: 89 },
                        { name: 'LE_MONDE_RSS', hits: 64 },
                        { name: 'FRANCE_INFO', hits: 52 },
                    ].map((src) => (
                        <div key={src.name} className="flex items-center justify-between border-b-2 border-stone-100 pb-2">
                            <span className="text-[11px] font-black uppercase tracking-tight text-stone-900">{src.name}</span>
                            <span className="text-[10px] font-bold bg-stone-900 text-white px-2 py-0.5 rounded-full">{src.hits}</span>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`w-12 h-6 border-2 border-stone-900 transition-colors relative ${checked ? 'bg-red-700' : 'bg-stone-200'}`}
        >
            <div className={`absolute top-0 w-4 h-4 border-2 border-stone-900 bg-white transition-all ${checked ? 'left-6' : 'left-0'}`} />
        </button>
    );
}
