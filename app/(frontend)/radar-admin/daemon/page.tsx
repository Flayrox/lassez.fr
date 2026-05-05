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

    useEffect(() => {
        fetchDaemonStatus();
        fetchPm2Status();
        const id = setInterval(() => {
            fetchDaemonStatus();
            fetchPm2Status();
        }, 15000);
        return () => clearInterval(id);
    }, []);

    const handleCommand = async (action: string, target: string) => {
        if (!confirm(`Are you sure you want to ${action} ${target}?`)) return;
        setActionRunning(true);
        try {
            const res = await fetch('/api/radar/system', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, target })
            });
            await fetchPm2Status();
            await fetchDaemonStatus();
        } catch (e) { console.error(e); }
        finally { setActionRunning(false); }
    };

    return (
        <ModernDashboardLayout 
            title="Daemon Control" 
            subtitle={countdown || "Autonomous system monitoring..."} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="space-y-8">
                {/* Status Overview */}
                <DaemonStatusCards status={status} loading={loading} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* PM2 Control */}
                    <div className="lg:col-span-2">
                        <Pm2ControlPanel 
                            pm2States={pm2States} 
                            pm2Loading={pm2Loading} 
                            onCommand={handleCommand} 
                        />
                    </div>

                    {/* Quick Config / Automation State */}
                    <div className="space-y-6">
                        <div className="bg-slate-900 rounded-2xl p-6 text-white shadow-xl">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6">Automation State</h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold">Auto-Pilot Mode</p>
                                    <div className={`w-2 h-2 rounded-full ${settings?.auto_pilot_enabled === 'true' ? 'bg-emerald-500' : 'bg-slate-700'}`}></div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold">RSS Ingestion</p>
                                    <div className={`w-2 h-2 rounded-full ${settings?.daemon_rss_enabled !== 'false' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                </div>
                                <div className="pt-4 border-t border-slate-800">
                                    <p className="text-[9px] text-slate-400 leading-relaxed font-medium">
                                        The autonomous engine is currently polling {JSON.parse(settings?.rss_feeds || '[]').length} RSS feeds and {JSON.parse(settings?.telegram_channels || '[]').length} Telegram channels.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">Manual Override</h3>
                            <button 
                                onClick={() => window.dispatchEvent(new CustomEvent('open-scan-modal'))}
                                className="w-full py-3 rounded-xl bg-slate-100 text-slate-900 text-xs font-bold uppercase tracking-tight hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                                Trigger Manual Scan
                            </button>
                        </div>
                    </div>
                </div>

                {/* System Logs Preview */}
                <div className="bg-slate-950 rounded-2xl p-6 shadow-2xl border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <h3 className="text-[10px] font-bold uppercase tracking-widest text-white">Live System Logs</h3>
                        </div>
                        <button className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors">Clear Stream</button>
                    </div>
                    <div className="bg-black/40 rounded-xl p-4 h-64 font-mono text-[11px] text-slate-300 overflow-y-auto leading-relaxed border border-white/5">
                        <p className="text-emerald-400">[INFO] System check passed. Daemon healthy.</p>
                        <p className="text-slate-500">[{new Date().toLocaleTimeString()}] Polling RSS sources...</p>
                        <p className="text-slate-500">[{new Date().toLocaleTimeString()}] No new items found in Mediapart.</p>
                        <p className="text-blue-400">[{new Date().toLocaleTimeString()}] 1 new item found in Telegram @FranceInsoumise.</p>
                        <p className="text-amber-400">[{new Date().toLocaleTimeString()}] Starting AI analysis for: "Manifestation retraites..."</p>
                    </div>
                </div>
            </div>
        </ModernDashboardLayout>
    );
}
