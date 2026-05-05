'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function ModernSidebar() {
    const pathname = usePathname();

    const menuItems = [
        { label: 'Overview', icon: 'dashboard', href: '/radar-admin' },
        { label: 'Command Center', icon: 'account_tree', href: '/radar-admin/flow', primary: true },
        { label: 'System Logs', icon: 'terminal', href: '/radar-admin/daemon' },
        { label: 'Global Settings', icon: 'settings', href: '/radar-admin/settings' },
    ];

    return (
        <aside className="w-64 flex flex-col border-r border-slate-200 bg-white/50 backdrop-blur-md">
            <div className="p-6">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                        <span className="material-symbols-outlined text-white text-sm">radar</span>
                    </div>
                    <span className="font-bold tracking-tighter text-lg">Cortex v3.1</span>
                </div>

                <nav className="space-y-1">
                    {menuItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-tight transition-all ${
                                pathname === item.href
                                    ? 'bg-black text-white shadow-lg'
                                    : item.primary 
                                        ? 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                        >
                            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="mt-auto p-6 border-t border-slate-100">
                <div className="bg-slate-900 rounded-xl p-4 text-white">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Engine Uptime</p>
                    <p className="text-sm font-mono font-bold">12:45:09</p>
                </div>
            </div>
        </aside>
    );
}
