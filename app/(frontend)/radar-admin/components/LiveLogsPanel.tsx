'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

type HealthMap = Record<string, { status: string; message: string }>;

const FILTERS: Array<{ key: string; label: string; icon: string }> = [
    { key: 'all', label: 'All', icon: 'list' },
    { key: 'Daemon', label: 'Engine', icon: 'settings_input_component' },
    { key: 'Node 1', label: 'Ingestion', icon: 'rss_feed' },
    { key: 'Node 6', label: 'Publisher', icon: 'send' },
    { key: 'ERROR', label: 'Critical', icon: 'report' }
];

function formatDate(input?: string | null) {
    if (!input) return '—';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function LiveLogsPanel({ compact = false }: { compact?: boolean }) {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [query, setQuery] = useState('');
    const [paused, setPaused] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
    const [health, setHealth] = useState<HealthMap>({});

    const viewportRef = useRef<HTMLDivElement>(null);
    const latestLengthRef = useRef(0);

    useEffect(() => { latestLengthRef.current = logs.length; }, [logs.length]);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/radar/logs', { cache: 'no-store' });
            const data = await res.json();
            if (!data.success) return;
            const incoming = data.logs || [];
            if (!paused) { setLogs(incoming); setPendingCount(0); }
            else {
                const delta = Math.max(0, incoming.length - latestLengthRef.current);
                if (delta > 0) setPendingCount(prev => prev + delta);
            }
        } catch (e) { console.error(e); }
    };

    const fetchDaemonStatus = async () => {
        try {
            const res = await fetch('/api/radar/daemon-status', { cache: 'no-store' });
            const data = await res.json();
            if (data.success) setDaemonStatus(data.status || null);
        } catch (e) { console.error(e); }
    };

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/radar/health', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && data.health) setHealth(data.health);
        } catch (e) { console.error(e); }
    };

    useEffect(() => {
        const runUpdates = () => {
            if (document.hidden) return; 
            fetchLogs(); fetchDaemonStatus(); fetchHealth();
        };
        runUpdates();
        const logsTimer = setInterval(() => !document.hidden && fetchLogs(), 5000); 
        const statusTimer = setInterval(() => !document.hidden && fetchDaemonStatus(), 15000);
        const healthTimer = setInterval(() => !document.hidden && fetchHealth(), 25000);
        return () => { clearInterval(logsTimer); clearInterval(statusTimer); clearInterval(healthTimer); };
    }, [paused]);

    useEffect(() => {
        if (!paused && viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
    }, [logs, paused]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return logs.filter((l) => {
            if (filter !== 'all') {
                if (filter === 'ERROR') {
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
        <div className="flex flex-col h-full bg-white text-slate-900 font-sans">
            {/* Header Metrics (Payload Grid) */}
            <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-slate-200">
                <MetricCard label="Engine Status" value={daemonStatus?.daemonHealth?.message || 'Stable'} active={true} border />
                <MetricCard label="Next Scan" value={formatDate(daemonStatus?.nextScanAt)} border />
                <MetricCard label="System Vitals" value={`${Object.keys(health).length} OK`} border />
                <MetricCard label="Post Queue" value={`${daemonStatus?.postCounts?.PENDING || 0} PENDING`} />
            </div>

            {/* Controls (Payload Toolbar) */}
            <div className="px-5 py-3 flex flex-col md:flex-row gap-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex gap-px bg-slate-200 border border-slate-200 rounded-sm overflow-hidden">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all ${
                                filter === f.key ? 'bg-black text-white' : 'bg-white text-slate-500 hover:text-black'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 relative">
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search logs..."
                        className="w-full bg-white border border-slate-200 rounded-sm py-1.5 px-3 font-mono text-[11px] focus:outline-none focus:border-black transition-colors"
                    />
                </div>
            </div>

            {/* Terminal Viewport */}
            <div 
                ref={viewportRef} 
                className="flex-1 overflow-y-auto p-5 font-mono text-[11px] bg-white space-y-0"
            >
                {filtered.map((line, idx) => (
                    <div key={line.id || idx} className="flex gap-4 py-0.5 border-b border-slate-50 hover:bg-slate-50 transition-colors group">
                        <span className="text-slate-300 shrink-0 select-none w-20">[{formatDate(line.timestamp)}]</span>
                        <span className={`shrink-0 font-bold w-24 ${line.level === 'ERROR' ? 'text-rose-600' : 'text-black'}`}>
                            {(line.nodeId || 'SYSTEM').toUpperCase()}
                        </span>
                        <span className="text-slate-600 flex-1">{line.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MetricCard({ label, value, active, border }: { label: string, value: string, active?: boolean, border?: boolean }) {
    return (
        <div className={`flex flex-col px-4 ${border ? 'border-r border-slate-100' : ''}`}>
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{label}</span>
            <span className={`text-[10px] font-bold uppercase ${active ? 'text-emerald-600' : 'text-black'}`}>{value}</span>
        </div>
    );
}
