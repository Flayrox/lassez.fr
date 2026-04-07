'use client';

import React from 'react';
import Link from 'next/link';

interface BrutalHeaderProps {
    title?: string;
    subtitle?: string;
    isDaemonRunning?: boolean;
}

export function BrutalHeader({ 
    title = "RADAR L'ASSEZ", 
    subtitle = "Intelligence OSINT & Social v3.0", 
    isDaemonRunning = true 
}: BrutalHeaderProps) {
    return (
        <header className="flex justify-between items-center w-full px-8 py-6 sticky top-0 z-40 bg-stone-50 border-b-4 border-stone-900 font-label">
            <div className="flex items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-stone-900 leading-none font-headline">{title}</h1>
                    <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mt-1">{subtitle}</p>
                </div>
                {isDaemonRunning && (
                    <div className="flex items-center gap-2 bg-stone-900 text-white px-3 py-1 brutal-border shadow-[2px_2px_0px_0px_#bc0100]">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-tighter">Daemon Running</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-6">
                <div className="hidden md:flex items-center gap-6 mr-8">
                    <Link href="#" className="text-red-700 font-bold border-b-4 border-red-700 pb-1 text-sm uppercase">RSS Feeds</Link>
                    <Link href="#" className="text-stone-600 font-bold text-sm uppercase hover:text-stone-900">Telegram</Link>
                    <Link href="#" className="text-stone-600 font-bold text-sm uppercase hover:text-stone-900">Templates</Link>
                </div>
                <div className="flex items-center gap-3">
                    <button className="bg-red-700 text-white px-4 py-2 brutal-border font-bold text-xs uppercase tracking-widest brutal-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">
                        Publish All
                    </button>
                    <button className="bg-white text-stone-900 px-4 py-2 brutal-border font-bold text-xs uppercase tracking-widest hover:bg-stone-200 transition-all">
                        <span className="material-symbols-outlined text-sm">terminal</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
