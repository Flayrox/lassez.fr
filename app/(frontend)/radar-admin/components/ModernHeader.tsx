'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';

interface ModernHeaderProps {
    title?: string;
    subtitle?: string;
    isDaemonRunning?: boolean;
    actions?: React.ReactNode;
}

export function ModernHeader({ 
    title = "CORTEX", 
    subtitle = "SYSTEM", 
    isDaemonRunning = true,
    actions
}: ModernHeaderProps) {
    const pathname = usePathname();
    const { isTerminalOpen, setTerminalOpen } = useUI();

    const navItems = [
        { label: 'Pipeline', href: '/radar-admin/flow', icon: 'account_tree' },
        { label: 'Posts Feed', href: '/radar-admin', icon: 'article' }, // Overview becomes Posts Feed
        { label: 'Templates', href: '/templates', icon: 'dashboard_customize' },
        { label: 'Real-time', href: '/radar-admin/daemon', icon: 'terminal' },
        { label: 'Settings', href: '/radar-admin/settings', icon: 'settings' },
    ];

    return (
        <header className="sticky top-0 z-[100] bg-white border-b border-slate-200 px-6 h-14 flex justify-between items-center font-sans">
            <div className="flex items-center h-full gap-8">
                <div className="flex items-center gap-4 pr-8 border-r border-slate-100 h-full">
                    <div className="w-7 h-7 bg-black flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-white text-[18px]">radar</span>
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-[10px] font-bold tracking-tight text-black leading-none uppercase">Radar</h1>
                        <span className="text-[9px] text-slate-400 mt-1 uppercase tracking-widest font-medium">v6.2</span>
                    </div>
                </div>

                <nav className="hidden lg:flex items-center h-full gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link 
                                key={item.href}
                                href={item.href}
                                className={`relative h-full px-4 flex items-center text-[11px] font-medium transition-all ${
                                    isActive ? 'text-black' : 'text-slate-500 hover:text-black'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-black' : 'text-slate-300'}`}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </div>
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="flex items-center gap-3">
                <AnimatePresence mode="wait">
                    {actions && (
                        <div className="flex items-center gap-2 pr-4 border-r border-slate-100 mr-1">
                            {actions}
                        </div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => setTerminalOpen(!isTerminalOpen)}
                    className={`flex items-center gap-2.5 px-3 py-1.5 border rounded-sm transition-all text-[11px] font-bold ${
                        isTerminalOpen ? 'bg-black border-black text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                >
                    <div className={`w-1.5 h-1.5 rounded-full ${isDaemonRunning ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    Logs
                </button>
                
                <button className="h-8 px-4 bg-black text-white text-[11px] font-bold uppercase tracking-wide hover:bg-zinc-800 transition-all rounded-sm">
                    Deploy
                </button>
            </div>
        </header>
    );
}
