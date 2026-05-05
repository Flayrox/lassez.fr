'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export function ModernSidebar() {
    const pathname = usePathname();

    const menuItems = [
        { label: 'Overview', icon: 'dashboard', href: '/radar-admin' },
        { label: 'Command Center', icon: 'account_tree', href: '/radar-admin/flow', primary: true },
        { label: 'System Logs', icon: 'terminal', href: '/radar-admin/daemon' },
        { label: 'Global Settings', icon: 'settings', href: '/radar-admin/settings' },
    ];

    return (
        <aside className="w-64 flex flex-col border-r border-slate-200/60 bg-white/40 backdrop-blur-2xl z-50">
            <div className="p-8">
                <div className="flex items-center gap-4 mb-12">
                    <motion.div 
                        whileHover={{ scale: 1.05, rotate: 5 }}
                        className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-2xl shadow-black/20"
                    >
                        <span className="material-symbols-outlined text-white text-[20px]">radar</span>
                    </motion.div>
                    <div className="flex flex-col">
                        <span className="font-black tracking-tighter text-lg leading-none">Cortex</span>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">v5.0 Engine</span>
                    </div>
                </div>

                <nav className="space-y-2">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="relative block group"
                            >
                                <div className={`flex items-center gap-3 px-5 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                                    isActive
                                        ? 'text-white'
                                        : 'text-slate-500 hover:text-slate-900'
                                }`}>
                                    <span className={`material-symbols-outlined text-[18px] transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400'}`}>
                                        {item.icon}
                                    </span>
                                    <span className="relative z-10">{item.label}</span>
                                </div>
                                {isActive && (
                                    <motion.div 
                                        layoutId="active-pill"
                                        className="absolute inset-0 bg-slate-900 rounded-2xl -z-0 shadow-lg shadow-slate-900/20"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="mt-auto p-8 border-t border-slate-100/50">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none" />
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Engine Uptime</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-xl font-mono font-black tracking-tighter">14:02:45</span>
                        <span className="text-[10px] font-bold text-emerald-400 animate-pulse">LIVE</span>
                    </div>
                    <motion.div 
                        className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors"
                    />
                </div>
            </div>
        </aside>
    );
}
