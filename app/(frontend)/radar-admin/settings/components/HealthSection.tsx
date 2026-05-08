'use client';

import React, { useEffect, useState } from 'react';

interface HealthSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

export function HealthSection({ form, updateForm }: HealthSectionProps) {
    const [health, setHealth] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/radar/health');
            const data = await res.json();
            if (data.success) setHealth(data.health);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => {
        fetchHealth();
        const timer = setInterval(fetchHealth, 30000);
        return () => clearInterval(timer);
    }, []);

    if (loading && !health) {
        return <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase text-[10px] tracking-widest">Scanning System Vitals...</div>;
    }

    return (
        <div className="space-y-10">
            <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">System Health</h3>
                <p className="text-[11px] text-slate-500 font-medium italic">Diagnostic overview of the Cortex infrastructure and external links.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {health && Object.entries(health).map(([key, data]: [string, any]) => (
                    <div key={key} className="p-4 bg-white border border-slate-200 rounded-xl flex items-center gap-4 hover:border-slate-400 transition-all group">
                        <div className={`w-2 h-2 rounded-full ${
                            data.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                            data.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
                        }`} />
                        <div className="flex-1">
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-0.5">{key}</h4>
                            <p className="text-[10px] text-slate-500 font-medium truncate">{data.message || 'No data available'}</p>
                        </div>
                        <span className="material-symbols-outlined text-slate-200 text-sm group-hover:text-slate-400 transition-colors">
                            {data.status === 'ok' ? 'check_circle' : 'report'}
                        </span>
                    </div>
                ))}
            </div>

            {/* Performance Metrics Placeholder */}
            <div className="mt-10 p-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-slate-400 text-sm">analytics</span>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cortex Performance</h4>
                </div>
                <div className="h-24 flex items-center justify-center text-[10px] text-slate-400 font-bold uppercase tracking-widest italic">
                    Performance telemetry integration pending V3 stabilization
                </div>
            </div>
        </div>
    );
}
