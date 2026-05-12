'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

type LogItem = {
    id: string;
    timestamp: string;
    level: string;
    nodeId: string;
    message: string;
};

type DaemonStatus = {
    daemonHealth?: { status: string; message: string };
    nextScanAt?: string | null;
    lastScanAt?: string | null;
    postCounts?: Record<string, number>;
};

const FILTERS = [
    { key: 'all', label: 'All signals' },
    { key: 'Daemon', label: 'Engine' },
    { key: 'Node 1', label: 'Ingestion' },
    { key: 'Node 6', label: 'Publisher' },
    { key: 'ERROR', label: 'Critical' }
];

function formatDate(input?: string | null) {
    if (!input) return '—';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function LiveLogsPanel({ compact }: { compact?: boolean }) {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [query, setQuery] = useState('');
    const [paused, setPaused] = useState(false);
    const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);

    const viewportRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/radar/logs', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && !paused) setLogs(data.logs || []);
        } catch (e) { console.error(e); }
    };

    const fetchDaemonStatus = async () => {
        try {
            const res = await fetch('/api/radar/daemon-status', { cache: 'no-store' });
            const data = await res.json();
            if (data.success) setDaemonStatus(data.status || null);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        fetchLogs(); fetchDaemonStatus();
        const logsTimer = setInterval(fetchLogs, 5000); 
        const statusTimer = setInterval(fetchDaemonStatus, 15000);
        return () => { clearInterval(logsTimer); clearInterval(statusTimer); };
    }, [paused]);

    useEffect(() => {
        if (!paused && viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
    }, [logs, paused]);

    const availableNodes = useMemo(() => {
        const nodes = new Set<string>();
        logs.forEach(l => { if (l.nodeId) nodes.add(l.nodeId); });
        return Array.from(nodes).sort();
    }, [logs]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return logs.filter((l) => {
            if (filter !== 'all') {
                if (filter === 'CRITICAL') {
                    if (l.level !== 'ERROR') return false;
                } else if (l.nodeId !== filter) {
                    return false;
                }
            }
            if (!q) return true;
            return (`${l.level} ${l.message} ${l.nodeId}`.toLowerCase().includes(q));
        });
    }, [logs, filter, query]);

    return (
        <div className="flex flex-col h-full bg-white text-slate-900 font-sans border border-slate-200 rounded-sm overflow-hidden shadow-2xl">
            {/* Minimal Metrics */}
            <div className="px-4 py-2 flex items-center gap-6 border-b border-slate-100 bg-white">
                <MetricItem label="Engine" value={daemonStatus?.daemonHealth?.message || 'Stable'} ok />
                <MetricItem label="Next scan" value={formatDate(daemonStatus?.nextScanAt)} />
                <MetricItem label="Pending" value={`${daemonStatus?.postCounts?.PENDING || 0} posts`} />
                <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setPaused(!paused)} className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all ${paused ? 'bg-amber-500 text-white' : 'text-slate-400 hover:text-black'}`}>
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="px-4 py-1.5 flex items-center gap-4 bg-slate-50/50 border-b border-slate-100">
                <div className="flex gap-1">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-2 py-0.5 text-[10px] font-bold transition-all rounded-sm ${
                            filter === 'all' ? 'bg-black text-white shadow-sm' : 'text-slate-400 hover:text-black'
                        }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('CRITICAL')}
                        className={`px-2 py-0.5 text-[10px] font-bold transition-all rounded-sm ${
                            filter === 'CRITICAL' ? 'bg-rose-600 text-white shadow-sm' : 'text-rose-400/60 hover:text-rose-600'
                        }`}
                    >
                        Critical
                    </button>
                    <div className="h-4 w-px bg-slate-200 mx-1 self-center" />
                    {availableNodes.map(node => (
                        <button
                            key={node}
                            onClick={() => setFilter(node)}
                            className={`px-2 py-0.5 text-[10px] font-bold transition-all rounded-sm uppercase tracking-tighter ${
                                filter === node ? 'bg-black text-white shadow-sm' : 'text-slate-400 hover:text-black'
                            }`}
                        >
                            {node}
                        </button>
                    ))}
                </div>
                <div className="flex-1">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter console..."
                        className="w-full bg-transparent border-none py-0.5 text-[11px] font-mono outline-none placeholder:text-slate-300"
                    />
                </div>
            </div>

            {/* Terminal */}
            <div 
                ref={viewportRef} 
                className="flex-1 overflow-y-auto p-4 font-mono text-[11px] bg-white"
            >
                <div className="space-y-0.5">
                    {filtered.map((line, idx) => (
                        <div key={line.id || idx} className="flex gap-3 leading-tight group">
                            <span className="text-slate-300 shrink-0 select-none font-mono">[{formatDate(line.timestamp)}]</span>
                            <span className={`shrink-0 font-bold w-20 ${
                                line.level === 'ERROR' ? 'text-rose-600' : 
                                line.level === 'SUCCESS' ? 'text-emerald-600' : 
                                'text-slate-400'
                            }`}>
                                {line.nodeId || 'SYSTEM'}
                            </span>
                            <span className={`${line.level === 'SUCCESS' ? 'text-emerald-700/80 font-medium' : 'text-slate-600'} truncate group-hover:whitespace-normal group-hover:overflow-visible transition-all`}>
                                {line.message}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function MetricItem({ label, value, ok }: { label: string, value: string, ok?: boolean }) {
    return (
        <div className="flex items-baseline gap-1.5">
            <span className="text-[9px] font-medium text-slate-400">{label}</span>
            <span className={`text-[10px] font-bold font-mono ${ok ? 'text-emerald-600' : 'text-black'}`}>{value}</span>
        </div>
    );
}
