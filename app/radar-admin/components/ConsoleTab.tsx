import React, { useState, useEffect, useRef } from 'react';
import { TooltipInfo } from './UIComponents';
import { StatusBadge } from './UIComponents';

export function ConsoleTab() {
    const [logs, setLogs] = useState<string[]>([]);
    const [filter, setFilter] = useState('TOUT');
    const [health, setHealth] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/radar/logs');
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/radar/health');
            const data = await res.json();
            if (data.success) {
                setHealth(data.health);
            }
        } catch (e) {
            console.error("Failed to fetch health", e);
        }
    };

    useEffect(() => {
        fetchLogs();
        const intervalLogs = setInterval(fetchLogs, 5000);
        
        fetchHealth();
        const intervalHealth = setInterval(fetchHealth, 30000);
        
        return () => {
            clearInterval(intervalLogs);
            clearInterval(intervalHealth);
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const renderHealthBadge = (key: string, label: string) => {
        if (!health || !health[key]) return null;
        const { status, message } = health[key];
        
        let colorClass = 'bg-stone-100 text-stone-500 border-stone-200';
        let dotColor = 'bg-stone-300';
        
        if (status === 'loading') {
            colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
            dotColor = 'bg-blue-500 animate-pulse';
        } else if (status === 'ok') {
            colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
            dotColor = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]';
        } else if (status === 'error') {
            colorClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
            dotColor = 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]';
        }

        return (
            <div className={`flex flex-col p-4 rounded-2xl border-2 ${colorClass} backdrop-blur-md transition-all hover:scale-[1.02]`}>
                <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">{label}</span>
                </div>
                <span className="text-[11px] font-bold opacity-80 leading-tight">
                    {message || "Flux nominal"}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-stone-950 rounded-[2.5rem] border-8 border-stone-900 overflow-hidden shadow-[20px_20px_0px_0px_rgba(0,0,0,1)] relative">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 via-purple-500 to-sky-500" />
                <div className="px-8 py-5 bg-stone-900/50 backdrop-blur-xl border-b-4 border-stone-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 bg-rose-500 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-white animate-ping" />
                            <span className="text-[10px] font-black text-white uppercase tracking-widest">Live Kernel</span>
                        </div>
                        <span className="text-[11px] font-black text-stone-500 uppercase tracking-[0.3em] hidden sm:inline">Stream Sémantique v2.4</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {['TOUT', 'ÉLECTIONS', 'DAEMON', 'WORDPRESS', 'ERREURS'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`text-[10px] px-4 py-2 rounded-xl font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-white text-black shadow-lg scale-105' : 'bg-stone-800 text-stone-500 hover:bg-stone-700 hover:text-stone-300'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
                <div 
                    ref={scrollRef}
                    className="p-8 h-[600px] overflow-y-auto font-mono text-[11px] leading-relaxed text-stone-400 selection:bg-rose-500/30 custom-scrollbar"
                >
                    {logs.map((line, i) => {
                        let show = true;
                        if (filter === 'ÉLECTIONS') show = line.includes('[Élections]') || line.includes('[DAEMON-PROXY]');
                        else if (filter === 'DAEMON') show = line.includes('[DAEMON]') || line.includes('[DAEMON-AUTO]');
                        else if (filter === 'WORDPRESS') show = line.includes('[WP-') || line.toLowerCase().includes('wordpress');
                        else if (filter === 'ERREURS') show = line.toLowerCase().includes('error') || line.toLowerCase().includes('échec') || line.toLowerCase().includes('erreur') || line.toLowerCase().includes('fail');
                        
                        if (!show) return null;

                        const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('échec') || line.toLowerCase().includes('fail');
                        const isSuccess = line.includes('✅') || line.includes('Succès') || line.includes('terminée');

                        return (
                            <div key={i} className={`group py-1 flex border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors ${isError ? 'text-rose-400 bg-rose-500/5' : ''} ${isSuccess ? 'text-emerald-400' : ''}`}>
                                <span className="text-stone-700 mr-6 select-none w-10 text-right shrink-0 font-black">{(i + 1).toString().padStart(4, '0')}</span>
                                <span className="break-all font-medium tracking-tight whitespace-pre-wrap">{line}</span>
                            </div>
                        );
                    })}
                    {logs.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-stone-700">
                            <div className="w-12 h-12 border-4 border-dashed border-stone-800 rounded-full animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Synchronisation du flux...</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border-8 border-stone-900 p-8 md:p-10 shadow-[20px_20px_0px_0px_rgba(28,25,23,1)]">
                <div className="flex items-center gap-4 mb-8">
                    <h3 className="text-2xl font-black uppercase tracking-tighter italic">Vitals du Système</h3>
                    <div className="h-px flex-1 bg-stone-900" />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {renderHealthBadge('database', 'Archives')}
                    {renderHealthBadge('daemon', 'Cortex CPU')}
                    {renderHealthBadge('gemini', 'Neurones IA')}
                    {renderHealthBadge('wordpress', 'WP Cloud')}
                    {renderHealthBadge('mastodon', 'Mastodon')}
                    {renderHealthBadge('bluesky', 'Bluesky')}
                    {renderHealthBadge('twitter', 'Twitter v2')}
                </div>
            </div>
        </div>
    );
}