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
        return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const cards = [
        { label: 'Engine Health', value: status?.daemonHealth?.message || 'Stable', status: status?.daemonHealth?.status === 'ok' },
        { label: 'Next scan window', value: formatDate(status?.nextScanAt) },
        { label: 'Last polling', value: formatDate(status?.lastScanAt) },
        { label: 'Pending tasks', value: `${status?.postCounts?.PENDING || 0} items` },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 bg-white p-1 rounded-sm border border-slate-200 shadow-sm">
            {cards.map((card, idx) => (
                <div key={idx} className="px-4 py-2 border-r last:border-r-0 border-slate-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{card.label}</span>
                        {card.status !== undefined && (
                            <div className={`w-1 h-1 rounded-full ${card.status ? 'bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                        )}
                    </div>
                    <p className="text-[11px] font-mono font-bold text-black truncate">
                        {loading ? '...' : card.value}
                    </p>
                </div>
            ))}
        </div>
    );
}
