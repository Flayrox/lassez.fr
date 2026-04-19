import React from 'react';
import { LiveLogsPanel } from './LiveLogsPanel';

export function ConsoleTab() {
    return (
        <div className="space-y-6">
            <div className="bg-stone-950 rounded-[2rem] border-8 border-stone-900 overflow-hidden shadow-[20px_20px_0px_0px_rgba(0,0,0,1)]">
                <div className="px-8 py-5 bg-stone-900/60 border-b-4 border-stone-900 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-[11px] font-black text-white uppercase tracking-widest">Console des scans en direct</span>
                    </div>
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Flux structuré unifié</span>
                </div>
                <div className="p-5">
                    <LiveLogsPanel />
                </div>
            </div>
        </div>
    );
}