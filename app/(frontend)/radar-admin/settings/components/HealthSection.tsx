'use client';

import React, { useEffect, useState } from 'react';

export function HealthSection() {
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
        return <div className="py-12 text-center animate-pulse text-slate-400 font-mono text-[10px]">Pinging system vitals...</div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-black">System health</h3>
                <span className="text-[10px] text-slate-400 font-mono">Real-time telemetry</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {health && Object.entries(health).map(([key, data]: [string, any]) => (
                    <div key={key} className="p-2.5 bg-white border border-slate-100 rounded-sm hover:border-slate-300 transition-all">
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                                data.status === 'ok' ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]' : 
                                data.status === 'warning' ? 'bg-amber-500' : 'bg-rose-500 shadow-[0_0_4px_rgba(244,63,94,0.5)]'
                            }`} />
                            <h4 className="text-[10px] font-bold text-black truncate capitalize">{key}</h4>
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono truncate leading-none">{data.message || 'Waiting...'}</p>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-4 bg-slate-50 border border-slate-100 border-dashed rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-slate-400 text-[14px]">analytics</span>
                    <h4 className="text-[10px] font-bold text-slate-500">Telemetry engine</h4>
                </div>
                <p className="text-[10px] text-slate-400 font-mono italic">
                    Performance streaming will be enabled after V3 core stabilization.
                </p>
            </div>
        </div>
    );
}
