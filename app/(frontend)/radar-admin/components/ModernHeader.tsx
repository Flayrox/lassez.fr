'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LiveLogsPanel } from './LiveLogsPanel';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface ModernHeaderProps {
    title?: string;
    subtitle?: string;
    isDaemonRunning?: boolean;
    actions?: React.ReactNode;
}

export function ModernHeader({ 
    title = "RADAR", 
    subtitle = "OSINT ENGINE v3.0", 
    isDaemonRunning = true,
    actions
}: ModernHeaderProps) {
    const pathname = usePathname();
    const [logsOpen, setLogsOpen] = useState(false);

    const isRadarActive = pathname === '/radar-admin';
    const isDaemonActive = pathname.startsWith('/radar-admin/daemon');
    const isSettingsActive = pathname.startsWith('/radar-admin/settings');
    const isFlowActive = pathname.startsWith('/radar-admin/flow');

    const navItems = [
        { label: 'Dashboard', href: '/radar-admin', active: isRadarActive },
        { label: 'Flow', href: '/radar-admin/flow', active: isFlowActive },
        { label: 'Daemon', href: '/radar-admin/daemon', active: isDaemonActive },
        { label: 'Settings', href: '/radar-admin/settings', active: isSettingsActive },
    ];

    return (
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 flex justify-between items-center">
            <div className="flex items-center gap-8">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-lg">R</span>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-tight uppercase">{title}</h1>
                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{subtitle}</p>
                    </div>
                </div>

                <nav className="hidden md:flex items-center gap-1">
                    {navItems.map((item) => (
                        <Link 
                            key={item.href}
                            href={item.href}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                                item.active 
                                    ? 'bg-slate-100 text-slate-900' 
                                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            }`}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="flex items-center gap-3">
                {actions}
                
                {isDaemonRunning && (
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-100">
                        <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-600"></span>
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-tight">Active</span>
                    </div>
                )}
                
                <button
                    onClick={() => setLogsOpen(true)}
                    className="h-8 px-3 rounded-md border border-slate-200 bg-white text-slate-600 text-xs font-medium hover:bg-slate-50 transition-all flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-sm">terminal</span>
                    Logs
                </button>
                
                <button className="h-8 px-4 rounded-md bg-black text-white text-xs font-medium hover:bg-slate-800 transition-all">
                    Quick Publish
                </button>
            </div>

            <AnimatePresence>
                {logsOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        <motion.div 
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-5xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
                        >
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <h3 className="text-sm font-bold uppercase tracking-tight text-slate-800">Live Daemon Output</h3>
                                </div>
                                <button
                                    onClick={() => setLogsOpen(false)}
                                    className="p-1.5 hover:bg-slate-100 rounded-md transition-colors"
                                >
                                    <span className="material-symbols-outlined text-slate-400">close</span>
                                </button>
                            </div>
                            <div className="p-0 overflow-y-auto max-h-[70vh] bg-slate-950">
                                <LiveLogsPanel compact />
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}
