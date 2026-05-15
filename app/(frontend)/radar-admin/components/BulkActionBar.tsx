'use client';

import React from 'react';

interface BulkActionBarProps {
    selectedIds: any[];
    onStatusUpdate: (status: string) => Promise<void>;
    onBulkDelete: () => Promise<void>;
    onClearSelection: () => void;
}

export function BulkActionBar({ selectedIds, onStatusUpdate, onBulkDelete, onClearSelection }: BulkActionBarProps) {
    if (selectedIds.length === 0) return null;

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black text-white px-4 py-2 rounded-md shadow-2xl z-[100] flex items-center gap-6 border border-zinc-800 animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-3 pr-6 border-r border-zinc-800">
                <span className="text-[10px] font-bold bg-white text-black px-1.5 py-0.5 rounded-sm min-w-[20px] text-center">
                    {selectedIds.length}
                </span>
                <span className="text-[10px] font-medium text-zinc-400">signals selected</span>
            </div>
            
            <div className="flex gap-2">
                <button 
                    onClick={() => onStatusUpdate('QUEUED')} 
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-sm text-[10px] font-bold hover:bg-zinc-800 transition-all"
                >
                    Queue
                </button>
                <button 
                    onClick={() => onStatusUpdate('REJECTED')} 
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-sm text-[10px] font-bold hover:text-rose-500 hover:border-rose-900 transition-all"
                >
                    Reject
                </button>
                <button 
                    onClick={() => onStatusUpdate('PUBLISHED')} 
                    className="px-4 py-1 bg-white text-black rounded-sm text-[10px] font-bold hover:bg-zinc-200 transition-all"
                >
                    Publish now
                </button>
                <div className="w-[1px] h-4 bg-zinc-800 self-center mx-1"></div>
                <button 
                    onClick={onBulkDelete} 
                    className="px-3 py-1 text-[10px] font-bold text-zinc-500 hover:text-red-500 transition-colors flex items-center gap-1"
                >
                    <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                    Delete
                </button>
                <button 
                    onClick={onClearSelection} 
                    className="ml-2 flex items-center justify-center text-zinc-500 hover:text-white transition-colors"
                >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
            </div>
        </div>
    );
}