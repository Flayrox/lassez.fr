'use client';

import React from 'react';

export function StudioExportBar({ progress }: { progress: string | null }) {
    if (!progress) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[300] flex items-center justify-center p-6 animate-in slide-in-from-bottom duration-300">
            <div className="max-w-xl w-full border shadow-2xl flex items-center gap-6 p-4 rounded-sm" 
                 style={{ background: '#131313', borderColor: '#2a2a2a', fontFamily: 'Inter, sans-serif' }}>
                
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-white rounded-full animate-spin"></div>
                </div>
                
                <div className="flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-white mb-0.5">Exportation Vidéo</p>
                    <p className="text-[12px] text-[#999] font-medium">{progress}</p>
                </div>
                
                <div className="text-[10px] text-[#555] uppercase font-semibold text-right leading-tight hidden sm:block">
                    Ne fermez pas<br/>cet onglet
                </div>
            </div>
        </div>
    );
}
