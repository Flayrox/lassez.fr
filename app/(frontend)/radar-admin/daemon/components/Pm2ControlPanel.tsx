'use client';

import React from 'react';

interface Pm2ControlPanelProps {
    pm2States: any;
    pm2Loading: boolean;
    onCommand: (action: string, target: string) => void;
}

export function Pm2ControlPanel({ pm2States, pm2Loading, onCommand }: Pm2ControlPanelProps) {
    const services = [
        { id: 'radar-daemon-rss', name: 'RSS Daemon' },
        { id: 'radar-api', name: 'Core API' },
        { id: 'radar-front', name: 'Frontend' },
    ];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="text-[10px] font-bold text-slate-900 uppercase tracking-widest">Process Infrastructure (PM2)</h3>
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${pm2Loading ? 'bg-amber-400 animate-spin' : 'bg-emerald-500'}`}></div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Live Monitor</span>
                </div>
            </div>
            <div className="p-6">
                <div className="grid gap-4">
                    {services.map((svc) => {
                        const state = pm2States[svc.id] || { online: false, status: 'offline', pid: null };
                        return (
                            <div key={svc.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className={`w-2 h-2 rounded-full ${state.online ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-900">{svc.name}</p>
                                        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">
                                            {state.status} {state.pid ? `• PID ${state.pid}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => onCommand('restart', svc.id)}
                                        className="h-8 px-3 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-tight hover:bg-slate-900 hover:text-white transition-all"
                                    >
                                        Restart
                                    </button>
                                    <button 
                                        onClick={() => onCommand('stop', svc.id)}
                                        className="h-8 px-3 rounded-lg bg-white border border-slate-200 text-rose-600 text-[10px] font-bold uppercase tracking-tight hover:bg-rose-50 hover:border-rose-200 transition-all"
                                    >
                                        Stop
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
