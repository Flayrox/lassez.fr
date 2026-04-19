'use client';

import React from 'react';

interface BulkActionBarProps {
    selectedIds: number[];
    onStatusUpdate: (status: string) => Promise<void>;
    onClearSelection: () => void;
}

export function BulkActionBar({ selectedIds, onStatusUpdate, onClearSelection }: BulkActionBarProps) {
    if (selectedIds.length === 0) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-stone-900 text-white p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(26,28,28,0.3)] z-[100] flex items-center gap-8 animate-in slide-in-from-bottom-10">
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-700 flex items-center justify-center font-black text-xl brutal-border border-white/20">
                    {selectedIds.length}
                </div>
                <div className="font-black uppercase text-[10px] tracking-widest text-stone-400">Signaux sélectionnés</div>
            </div>
            <div className="flex gap-3">
                <button onClick={() => onStatusUpdate('APPROVED')} className="px-6 py-2 bg-stone-800 border-2 border-stone-700 font-bold uppercase text-[10px] tracking-widest hover:border-white transition-all">Approuver</button>
                <button onClick={() => onStatusUpdate('REJECTED')} className="px-6 py-2 bg-stone-800 border-2 border-stone-700 font-bold uppercase text-[10px] tracking-widest hover:border-red-700 transition-all">Rejeter</button>
                <button onClick={() => onStatusUpdate('PUBLISHED')} className="px-8 py-2 bg-red-700 border-2 border-red-600 font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all">Publier 🚀</button>
                <button onClick={onClearSelection} className="ml-4 material-symbols-outlined text-stone-500 hover:text-white transition-colors">close</button>
            </div>
        </div>
    );
}