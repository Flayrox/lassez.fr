'use client';

import React from 'react';

interface Pm2ControlPanelProps {
    pm2States: any;
    pm2Loading: boolean;
    onCommand: (action: string, target: string) => void;
}

export function Pm2ControlPanel({ pm2States, pm2Loading, onCommand }: Pm2ControlPanelProps) {
    const services = [
        { id: 'radar-daemon-rss', name: 'RSS daemon' },
        { id: 'radar-api', name: 'Core API' },
        { id: 'radar-front', name: 'Frontend' },
    ];

    return (
        <div className="bg-white border border-slate-200 rounded-sm shadow-sm overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-white">
                <h3 className="text-[11px] font-bold text-black">Process infrastructure</h3>
                <div className="flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full ${pm2Loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]'}`} />
                    <span className="text-[10px] font-medium text-slate-400 font-mono italic">PM2 monitor</span>
                </div>
            </div>
            
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] text-slate-500 font-medium">
                        <th className="px-4 py-1.5 w-8">Status</th>
                        <th className="px-4 py-1.5">Service</th>
                        <th className="px-4 py-1.5">Identifier</th>
                        <th className="px-4 py-1.5">Details</th>
                        <th className="px-4 py-1.5 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {services.map((svc) => {
                        const state = pm2States[svc.id] || { online: false, status: 'offline', pid: null };
                        return (
                            <tr key={svc.id} className="hover:bg-slate-50/50 transition-colors group">
                                <td className="px-4 py-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${state.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                </td>
                                <td className="px-4 py-2 text-[11px] font-bold text-black">{svc.name}</td>
                                <td className="px-4 py-2 text-[10px] font-mono text-slate-400 italic">{svc.id}</td>
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-bold font-mono px-1 rounded-sm ${state.online ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400 bg-slate-50'}`}>
                                            {state.status.toUpperCase()}
                                        </span>
                                        {state.pid && <span className="text-[10px] text-slate-400 font-mono">PID {state.pid}</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-2 text-right">
                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                            onClick={() => onCommand('restart', svc.id)}
                                            className="h-6 px-2.5 rounded-sm bg-black text-white text-[10px] font-bold hover:bg-zinc-800 transition-all"
                                        >
                                            Restart
                                        </button>
                                        <button 
                                            onClick={() => onCommand('stop', svc.id)}
                                            className="h-6 px-2.5 rounded-sm bg-white border border-slate-200 text-slate-400 text-[10px] font-bold hover:text-rose-500 hover:border-rose-200 transition-all"
                                        >
                                            Stop
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
