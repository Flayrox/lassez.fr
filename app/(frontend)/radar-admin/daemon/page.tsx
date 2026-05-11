'use client';

import React, { useEffect, useState } from 'react';
import { ModernDashboardLayout } from '../components/ModernDashboardLayout';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { DaemonStatusCards } from './components/DaemonStatusCards';
import { Pm2ControlPanel } from './components/Pm2ControlPanel';
import { motion } from 'framer-motion';

export default function DaemonPage() {
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();
    const [status, setStatus] = useState<any>(null);
    const [pm2States, setPm2States] = useState<any>({});
    const [loading, setLoading] = useState(true);
    const [pm2Loading, setPm2Loading] = useState(false);
    const [actionRunning, setActionRunning] = useState(false);
    const [logs, setLogs] = useState<any[]>([]);

    const fetchDaemonStatus = async () => {
        try {
            const res = await fetch('/api/radar/daemon-status');
            const data = await res.json();
            if (data.success) setStatus(data.status);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchPm2Status = async () => {
        setPm2Loading(true);
        try {
            const res = await fetch('/api/radar/system');
            const data = await res.json();
            if (data.success) setPm2States(data.states);
        } catch (e) { console.error(e); }
        finally { setPm2Loading(false); }
    };

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/radar/logs');
            const data = await res.json();
            if (data.success) setLogs(data.logs);
        } catch (e) {}
    };

    useEffect(() => {
        fetchDaemonStatus();
        fetchPm2Status();
        fetchLogs();
        const id = setInterval(() => {
            fetchDaemonStatus();
            fetchPm2Status();
            fetchLogs();
        }, 5000); // Plus rapide pour les logs
        return () => clearInterval(id);
    }, []);

    const handleCommand = async (action: string, target: string) => {
        if (!confirm(`Are you sure you want to ${action} ${target}?`)) return;
        setActionRunning(true);
        try {
            await fetch('/api/radar/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, target })
            });
            await fetchPm2Status();
            await fetchDaemonStatus();
        } catch (e) { console.error(e); }
        finally { setActionRunning(false); }
    };

    const feedsCount = JSON.parse(settings?.rss_feeds || '[]').length;
    const channelsCount = JSON.parse(settings?.telegram_channels || '[]').length;

    return (
        <ModernDashboardLayout 
            title="Real-time" 
            subtitle={countdown || "Autonomous system monitoring"} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="space-y-6">
                {/* Status Bar */}
                <DaemonStatusCards status={status} loading={loading} />

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* PM2 Control */}
                    <div className="lg:col-span-3">
                        <Pm2ControlPanel 
                            pm2States={pm2States} 
                            pm2Loading={pm2Loading} 
                            onCommand={handleCommand} 
                        />
                    </div>

                    {/* Sidebar Controls */}
                    <div className="space-y-4">
                        <div className="bg-black rounded-sm p-4 text-white shadow-xl">
                            <h3 className="text-[10px] font-bold uppercase tracking-tighter text-zinc-500 mb-4">Automation metrics</h3>
                            <div className="space-y-3">
                                <MetricRow label="Auto-pilot" active={settings?.auto_pilot_enabled === 'true'} />
                                <MetricRow label="RSS ingestion" active={settings?.daemon_rss_enabled !== 'false'} />
                                <div className="pt-3 border-t border-zinc-800">
                                    <p className="text-[9px] text-zinc-500 leading-relaxed font-mono italic">
                                        Polling {feedsCount} feeds and {channelsCount} channels.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-sm border border-slate-200 p-4 shadow-sm">
                            <h3 className="text-[10px] font-bold text-slate-400 mb-3">Orchestration</h3>
                            <button 
                                onClick={() => window.dispatchEvent(new CustomEvent('open-scan-modal'))}
                                className="w-full py-1.5 rounded-sm bg-slate-100 text-black text-[11px] font-bold hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[16px]">sync_alt</span>
                                Manual trigger
                            </button>
                        </div>
                    </div>
                </div>

                {/* System Logs Preview */}
                <div className="bg-white rounded-sm shadow-sm border border-slate-200 overflow-hidden">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-2">
                            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                            <h3 className="text-[11px] font-bold text-black">Live telemetry stream</h3>
                        </div>
                        <button className="text-[10px] font-bold text-slate-400 hover:text-black transition-colors">Clear</button>
                    </div>
                    <div className="p-4 h-64 font-mono text-[11px] text-slate-600 overflow-y-auto leading-tight bg-white flex flex-col-reverse">
                        <div className="space-y-0.5">
                            {logs.length > 0 ? logs.map((log: any, idx: number) => (
                                <LogLine 
                                    key={log.id || idx}
                                    color={log.level === 'ERROR' ? 'text-rose-600' : log.level === 'SUCCESS' ? 'text-emerald-600' : log.level === 'WARN' ? 'text-amber-600' : 'text-slate-500'} 
                                    msg={`[${log.nodeId || 'SYS'}] ${log.message}`} 
                                    time={log.timestamp} 
                                />
                            )) : (
                                <p className="text-slate-300 italic">En attente de télémétrie...</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </ModernDashboardLayout>
    );
}

function MetricRow({ label, active }: { label: string, active: boolean }) {
    return (
        <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-zinc-400">{label}</p>
            <div className={`w-1 h-1 rounded-full ${active ? 'bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]' : 'bg-zinc-700'}`}></div>
        </div>
    );
}

function LogLine({ msg, color = "text-slate-400", time }: { msg: string, color?: string, time?: any }) {
    const timeStr = time ? new Date(time).toLocaleTimeString() : '--:--:--';
    return (
        <div className="flex gap-3">
            <span className="text-slate-200 shrink-0 select-none">[{timeStr}]</span>
            <span className={`${color} flex-1`}>{msg}</span>
        </div>
    );
}
