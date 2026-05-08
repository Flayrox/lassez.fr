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
        <header className="sticky top-0 z-[100] bg-white border-b border-slate-200 px-4 h-11 flex justify-between items-center font-sans">
            <div className="flex items-center h-full gap-6">
                <div className="flex items-center gap-2 pr-6 border-r border-slate-100 h-full">
                    <div className="w-5 h-5 bg-black flex items-center justify-center shrink-0 rounded-sm">
                        <span className="material-symbols-outlined text-white text-[14px]">radar</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <h1 className="text-[11px] font-bold text-black leading-none">Radar</h1>
                        <span className="text-[10px] text-slate-400 font-medium">v6.2</span>
                    </div>
                </div>

                <nav className="hidden lg:flex items-center h-full gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link 
                                key={item.href}
                                href={item.href}
                                className={`relative h-full px-3 flex items-center text-[11px] font-medium transition-all ${
                                    isActive ? 'text-black' : 'text-slate-500 hover:text-black'
                                }`}
                            >
                                {item.label}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-black" />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="flex items-center gap-2">
                <AnimatePresence mode="wait">
                    {actions && (
                        <div className="flex items-center gap-2 pr-2 border-r border-slate-100 mr-1">
                            {actions}
                        </div>
                    )}
                </AnimatePresence>

                <button
                    onClick={() => setTerminalOpen(!isTerminalOpen)}
                    className={`flex items-center gap-2 px-2.5 py-1 border rounded-md transition-all text-[11px] font-medium ${
                        isTerminalOpen ? 'bg-black border-black text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                    }`}
                >
                    <div className={`w-1 h-1 rounded-full ${isDaemonRunning ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                    Logs
                </button>
                
                <button 
                    disabled={isTerminalOpen && !isDaemonRunning}
                    onClick={async () => {
                        try {
                            const btn = document.getElementById('header-scan-btn');
                            if (btn) btn.innerText = 'Scanning...';
                            await fetch('/api/radar/trigger', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ action: 'scan' })
                            });
                        } catch (e) {
                            alert('Erreur scan.');
                        } finally {
                            const btn = document.getElementById('header-scan-btn');
                            if (btn) btn.innerText = 'Scan';
                        }
                    }}
                    id="header-scan-btn"
                    className="h-7 px-3 bg-black text-white text-[11px] font-medium hover:bg-zinc-800 transition-all rounded-md flex items-center gap-2"
                >
                    Scan
                </button>
            </div>
        </header>
    );
}
