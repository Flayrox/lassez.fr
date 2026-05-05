'use client';

import React from 'react';

interface DaemonStatusCardsProps {
    status: any;
    loading: boolean;
}

export function DaemonStatusCards({ status, loading }: DaemonStatusCardsProps) {
    const formatDate = (value?: string | null) => {
        if (!value) return '—';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '—';
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    };

    const cards = [
        { label: 'Daemon Status', value: status?.daemonHealth?.message || 'Offline', icon: 'monitor_heart', color: 'text-slate-900' },
        { label: 'Next Scan', value: formatDate(status?.nextScanAt), icon: 'schedule', color: 'text-blue-600' },
        { label: 'Last Activity', value: formatDate(status?.lastScanAt), icon: 'history', color: 'text-slate-500' },
        { label: 'Pending Queue', value: status?.postCounts?.PENDING || 0, icon: 'queue', color: 'text-amber-600' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, idx) => (
                <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <span className="material-symbols-outlined text-slate-300 text-xl">{card.icon}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${card.label === 'Daemon Status' && card.value.includes('Alive') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-200'}`}></div>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{card.label}</p>
                    <p className={`text-lg font-bold truncate ${card.color}`}>
                        {loading ? '...' : card.value}
                    </p>
                </div>
            ))}
        </div>
    );
}
