import React, { useEffect, useMemo, useRef, useState } from 'react';

type LogItem = {
    timestamp: string;
    level: string;
    category: 'daemon' | 'schedule' | 'manual' | 'publisher' | 'elections' | 'error' | 'other';
    message: string;
};

type DaemonStatus = {
    daemonHealth?: { status: string; message: string };
    nextScanAt?: string | null;
    lastScanAt?: string | null;
    postCounts?: Record<string, number>;
};

type HealthMap = Record<string, { status: string; message: string }>;

type LiveLogsPanelProps = {
    compact?: boolean;
};

const FILTERS: Array<{ key: string; label: string }> = [
    { key: 'all', label: 'Tout' },
    { key: 'daemon', label: 'Daemon' },
    { key: 'schedule', label: 'Programmation' },
    { key: 'manual', label: 'Manuel' },
    { key: 'publisher', label: 'Publication' },
    { key: 'elections', label: 'Élections' },
    { key: 'error', label: 'Erreurs' }
];

function formatDate(input?: string | null) {
    if (!input) return '—';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR');
}

export function LiveLogsPanel({ compact = false }: LiveLogsPanelProps) {
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [filter, setFilter] = useState<string>('all');
    const [query, setQuery] = useState('');
    const [paused, setPaused] = useState(false);
    const [pendingCount, setPendingCount] = useState(0);
    const [daemonStatus, setDaemonStatus] = useState<DaemonStatus | null>(null);
    const [health, setHealth] = useState<HealthMap>({});

    const viewportRef = useRef<HTMLDivElement>(null);
    const latestLengthRef = useRef(0);

    useEffect(() => {
        latestLengthRef.current = logs.length;
    }, [logs.length]);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/radar/logs', { cache: 'no-store' });
            const data = await res.json();
            if (!data.success) return;

            const incoming = Array.isArray(data.logsStructured) ? data.logsStructured : [];
            if (!paused) {
                setLogs(incoming);
                setPendingCount(0);
            } else {
                const delta = Math.max(0, incoming.length - latestLengthRef.current);
                if (delta > 0) setPendingCount(prev => prev + delta);
            }
        } catch (e) {
            console.error('Impossible de récupérer les logs', e);
        }
    };

    const fetchDaemonStatus = async () => {
        try {
            const res = await fetch('/api/radar/daemon-status', { cache: 'no-store' });
            const data = await res.json();
            if (data.success) setDaemonStatus(data.status || null);
        } catch (e) {
            console.error('Impossible de récupérer le statut daemon', e);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/radar/health', { cache: 'no-store' });
            const data = await res.json();
            if (data.success && data.health) {
                setHealth(data.health);
            }
        } catch (e) {
            console.error('Impossible de récupérer les vitals', e);
        }
    };

    useEffect(() => {
        fetchLogs();
        fetchDaemonStatus();
        fetchHealth();

        const logsTimer = setInterval(fetchLogs, 4000);
        const statusTimer = setInterval(fetchDaemonStatus, 10000);
        const healthTimer = setInterval(fetchHealth, 15000);

        return () => {
            clearInterval(logsTimer);
            clearInterval(statusTimer);
            clearInterval(healthTimer);
        };
    }, [paused]);

    useEffect(() => {
        if (!paused && viewportRef.current) {
            viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
        }
    }, [logs, paused]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return logs.filter((l) => {
            if (filter !== 'all' && l.category !== filter) return false;
            if (!q) return true;
            return (`${l.level} ${l.message} ${l.category}`.toLowerCase().includes(q));
        });
    }, [logs, filter, query]);

    return (
        <div className={`space-y-5 ${compact ? '' : 'animate-in fade-in duration-500'}`}>
            <section className="bg-stone-900 text-stone-100 border-4 border-stone-900 p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[10px] font-black uppercase tracking-widest">
                    <div className="bg-stone-800 p-3 border-2 border-stone-700">
                        <div className="text-stone-400">État daemon</div>
                        <div className="mt-1 text-xs text-white">{daemonStatus?.daemonHealth?.message || '—'}</div>
                    </div>
                    <div className="bg-stone-800 p-3 border-2 border-stone-700">
                        <div className="text-stone-400">Prochain scan</div>
                        <div className="mt-1 text-xs text-white">{formatDate(daemonStatus?.nextScanAt || null)}</div>
                    </div>
                    <div className="bg-stone-800 p-3 border-2 border-stone-700">
                        <div className="text-stone-400">Dernier scan</div>
                        <div className="mt-1 text-xs text-white">{formatDate(daemonStatus?.lastScanAt || null)}</div>
                    </div>
                    <div className="bg-stone-800 p-3 border-2 border-stone-700">
                        <div className="text-stone-400">Queue</div>
                        <div className="mt-1 text-xs text-white">PENDING {daemonStatus?.postCounts?.PENDING || 0} | APPROVED {daemonStatus?.postCounts?.APPROVED || 0}</div>
                    </div>
                </div>
            </section>

            <section className="bg-white border-4 border-stone-900 p-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-3">Vitals services</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {Object.entries(health).map(([key, value]) => (
                        <div key={key} className={`border-2 p-2 ${value.status === 'ok' ? 'bg-emerald-50 border-emerald-300' : value.status === 'loading' ? 'bg-sky-50 border-sky-300' : 'bg-rose-50 border-rose-300'}`}>
                            <div className="text-[9px] font-black uppercase tracking-widest">{key}</div>
                            <div className="text-[10px] font-bold uppercase mt-1 truncate">{value.message || value.status}</div>
                        </div>
                    ))}
                    {Object.keys(health).length === 0 && (
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-400">Chargement vitals...</div>
                    )}
                </div>
            </section>

            <section className="bg-stone-950 border-4 border-stone-900 overflow-hidden">
                <div className="p-4 border-b-4 border-stone-900 bg-stone-900/70 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                        {FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-1 border-2 text-[10px] font-black uppercase tracking-widest ${filter === f.key ? 'bg-white text-black border-white' : 'bg-stone-800 text-stone-300 border-stone-700 hover:bg-stone-700'}`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-col md:flex-row gap-3 md:items-center">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher dans les logs..."
                            className="flex-1 bg-stone-800 text-stone-100 border-2 border-stone-700 p-2 font-mono text-xs"
                        />
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPaused(v => !v)}
                                className={`px-3 py-2 border-2 text-[10px] font-black uppercase tracking-widest ${paused ? 'bg-amber-500 text-black border-amber-600' : 'bg-stone-800 text-stone-100 border-stone-700'}`}
                            >
                                {paused ? 'Reprendre' : 'Pause auto-scroll'}
                            </button>
                            {paused && pendingCount > 0 && (
                                <span className="px-2 py-1 bg-red-700 text-white text-[10px] font-black uppercase">+{pendingCount} nouveaux</span>
                            )}
                        </div>
                    </div>
                </div>

                <div ref={viewportRef} className={`${compact ? 'h-[360px]' : 'h-[560px]'} overflow-y-auto p-4 font-mono text-xs bg-black text-stone-100`}>
                    {filtered.length === 0 ? (
                        <div className="text-stone-500 font-black uppercase tracking-widest">Aucun log pour ce filtre.</div>
                    ) : (
                        filtered.map((line, idx) => (
                            <div key={`${line.timestamp}-${idx}`} className={`py-1 border-b border-white/5 ${line.category === 'error' ? 'text-rose-400' : line.category === 'schedule' ? 'text-amber-300' : line.category === 'manual' ? 'text-sky-300' : ''}`}>
                                <span className="text-stone-500 mr-2">[{line.timestamp}]</span>
                                <span className="mr-2 font-black">[{line.category.toUpperCase()}]</span>
                                <span>{line.message}</span>
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}
