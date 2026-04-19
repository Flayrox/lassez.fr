'use client';

import React from 'react';
import Link from 'next/link';
import { useRadarAdmin } from './RadarAdminContext';

export function BrutalSidePanels() {
    const { settings } = useRadarAdmin();

    const rssEnabled = settings?.daemon_rss_enabled === 'true';
    const electionsEnabled = settings?.daemon_elections_enabled === 'true';
    const autoPilotEnabled = settings?.auto_pilot_enabled === 'true';
    const discordTestMode = settings?.discord_test_mode === 'true';

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
                        <span className={`text-[10px] font-black uppercase px-2 py-1 border-2 ${rssEnabled ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-200 text-stone-700 border-stone-300'}`}>
                            {rssEnabled ? 'ON' : 'OFF'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-stone-600">Elections Tracker</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 border-2 ${electionsEnabled ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-200 text-stone-700 border-stone-300'}`}>
                            {electionsEnabled ? 'ON' : 'OFF'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-stone-600">Auto Pilot</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 border-2 ${autoPilotEnabled ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-stone-200 text-stone-700 border-stone-300'}`}>
                            {autoPilotEnabled ? 'ON' : 'OFF'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase text-stone-600">Discord Test</span>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 border-2 ${discordTestMode ? 'bg-amber-600 text-white border-amber-600' : 'bg-stone-200 text-stone-700 border-stone-300'}`}>
                            {discordTestMode ? 'TEST ON' : 'OFF'}
                        </span>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t-2 border-stone-200 flex flex-wrap gap-2">
                    <Link href="/radar-admin/settings?tab=sources" className="px-3 py-2 bg-white border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest hover:bg-stone-100">
                        Config Sources
                    </Link>
                    <Link href="/radar-admin/settings?tab=users" className="px-3 py-2 bg-white border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest hover:bg-stone-100">
                        Config Users
                    </Link>
                    <Link href="/radar-admin/settings?tab=elections" className="px-3 py-2 bg-white border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest hover:bg-stone-100">
                        Config Elections
                    </Link>
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
