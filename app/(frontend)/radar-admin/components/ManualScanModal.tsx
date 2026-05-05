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
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                    />
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="bg-white rounded-2xl border border-slate-200 w-full max-w-xl shadow-2xl overflow-hidden relative z-10"
                    >
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-sm font-bold uppercase tracking-tight text-slate-800">Trigger Manual Scan</h2>
                            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                                <span className="material-symbols-outlined text-slate-400">close</span>
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Model</label>
                                    <select 
                                        value={scanConfig.model}
                                        onChange={e => setScanConfig({...scanConfig, model: e.target.value})}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none"
                                    >
                                        <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                                        <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lookback Window</label>
                                    <select 
                                        value={scanConfig.lookbackHours}
                                        onChange={e => setScanConfig({...scanConfig, lookbackHours: parseInt(e.target.value) || 24})}
                                        className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none"
                                    >
                                        <option value="2">2 Hours</option>
                                        <option value="12">12 Hours</option>
                                        <option value="24">24 Hours</option>
                                        <option value="168">7 Days</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Allow Content Types</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'].map(type => (
                                        <label key={type} className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all cursor-pointer ${
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
                                                className="w-4 h-4 rounded border-slate-300 text-black focus:ring-black" 
                                            />
                                            <span className="text-[10px] font-bold uppercase tracking-tight">{type.split('!')[0].split('JOUR')[0].split('GE')[0].split('IR')[0]}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Max Articles</label>
                                <input 
                                    type="number" 
                                    min="1" max="100"
                                    value={scanConfig.count}
                                    onChange={e => setScanConfig({...scanConfig, count: parseInt(e.target.value) || 10})}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold focus:ring-2 focus:ring-slate-100 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Persist Results to Database</span>
                                <button 
                                    onClick={() => setScanConfig({...scanConfig, saveDb: !scanConfig.saveDb})}
                                    className={`w-10 h-5 rounded-full transition-all relative ${scanConfig.saveDb ? 'bg-black' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${scanConfig.saveDb ? 'left-5.5' : 'left-0.5'}`} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4 border-t border-slate-100 flex justify-end gap-3 bg-slate-50/50">
                            <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-slate-900 transition-colors">Cancel</button>
                            <button 
                                onClick={() => onLaunch(scanConfig)}
                                className="bg-black text-white px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-tight hover:bg-slate-800 transition-all shadow-md"
                            >
                                Start Cortex Engine
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}