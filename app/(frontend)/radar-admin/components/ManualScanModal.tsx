'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ManualScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunch: (config: any) => Promise<void>;
}

export function ManualScanModal({ isOpen, onClose, onLaunch }: ManualScanModalProps) {
    const [scanConfig, setScanConfig] = useState({
        model: 'gemini-1.5-pro',
        types: ['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'],
        count: 10,
        lookbackHours: 24,
        prompt: '',
        saveDb: true
    });

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 font-sans">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-white/60 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ scale: 0.98, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 10 }}
                        className="bg-white border border-slate-200 w-full max-w-lg shadow-2xl rounded-sm overflow-hidden relative z-10"
                    >
                        <div className="px-4 py-2.5 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h2 className="text-[11px] font-bold text-black">Trigger manual scan</h2>
                            <button onClick={onClose} className="text-slate-400 hover:text-black transition-colors">
                                <span className="material-symbols-outlined text-[18px]">close</span>
                            </button>
                        </div>
                        
                        <div className="p-5 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-400">Processing model</label>
                                    <select 
                                        value={scanConfig.model}
                                        onChange={e => setScanConfig({...scanConfig, model: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-mono font-bold focus:border-black outline-none transition-all"
                                    >
                                        <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                                        <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-400">Lookback window</label>
                                    <select 
                                        value={scanConfig.lookbackHours}
                                        onChange={e => setScanConfig({...scanConfig, lookbackHours: parseInt(e.target.value) || 24})}
                                        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-mono font-bold focus:border-black outline-none transition-all"
                                    >
                                        <option value="2">2h window</option>
                                        <option value="12">12h window</option>
                                        <option value="24">24h window</option>
                                        <option value="168">7d window</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-medium text-slate-400">Content routing filter</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'].map(type => (
                                        <label key={type} className={`flex items-center gap-2 px-3 py-1.5 rounded-sm border transition-all cursor-pointer ${
                                            scanConfig.types.includes(type) ? 'border-black bg-slate-50' : 'border-slate-100 bg-white hover:border-slate-300'
                                        }`}>
                                            <input 
                                                type="checkbox" 
                                                checked={scanConfig.types.includes(type)}
                                                onChange={e => {
                                                    const newTypes = e.target.checked 
                                                        ? [...scanConfig.types, type]
                                                        : scanConfig.types.filter(t => t !== type);
                                                    setScanConfig({...scanConfig, types: newTypes});
                                                }}
                                                className="w-3.5 h-3.5 rounded-sm border-slate-300 text-black focus:ring-black" 
                                            />
                                            <span className="text-[10px] font-bold">{type.replace(/[^\w\s]/gi, '').trim() || 'General'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-center">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-medium text-slate-400">Max signals count</label>
                                    <input 
                                        type="number" min="1" max="100"
                                        value={scanConfig.count}
                                        onChange={e => setScanConfig({...scanConfig, count: parseInt(e.target.value) || 10})}
                                        className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-mono font-bold focus:border-black outline-none transition-all"
                                    />
                                </div>
                                <div className="flex items-center justify-between p-2 mt-4 bg-slate-50 rounded-sm border border-slate-100 border-dashed">
                                    <span className="text-[10px] font-medium text-slate-500">Persist to DB</span>
                                    <button 
                                        onClick={() => setScanConfig({...scanConfig, saveDb: !scanConfig.saveDb})}
                                        className={`w-6 h-3.5 rounded-full relative transition-all ${scanConfig.saveDb ? 'bg-black' : 'bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${scanConfig.saveDb ? 'left-3' : 'left-0.5'}`} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50">
                            <button onClick={onClose} className="px-3 py-1 text-[11px] font-medium text-slate-400 hover:text-black transition-colors">Cancel</button>
                            <button 
                                onClick={() => onLaunch(scanConfig)}
                                className="bg-black text-white px-4 py-1 rounded-sm text-[11px] font-bold hover:bg-zinc-800 transition-all shadow-sm"
                            >
                                Start scan
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}