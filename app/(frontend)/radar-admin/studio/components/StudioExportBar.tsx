'use client';

import React from 'react';

export function StudioExportBar({ progress }: { progress: string | null }) {
    if (!progress) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-black/90 border-t border-white/10 p-4 z-[300] flex items-center justify-center">
            <div className="flex items-center gap-4 max-w-xl w-full">
                <div className="w-12 h-12 flex items-center justify-center shrink-0">
                    <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                </div>
                <div className="flex-1">
                    <p className="sm text-[10px] font-black uppercase tracking-widest text-white mb-1">Traitement Vidéo en cours</p>
                    <p className="sm text-[12px] text-gray-400">{progress}</p>
                </div>
                <div className="sm text-[9px] text-gray-500 uppercase text-right leading-tight">
                    Ne fermez pas cet onglet<br/>Directement dans votre navigateur
                </div>
            </div>
        </div>
    );
}
