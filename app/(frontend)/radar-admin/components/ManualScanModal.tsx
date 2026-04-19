'use client';

import React, { useState } from 'react';

interface ManualScanModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLaunch: (config: any) => Promise<void>;
}

export function ManualScanModal({ isOpen, onClose, onLaunch }: ManualScanModalProps) {
    const [scanConfig, setScanConfig] = useState({
        model: 'gemini-3.1-pro-preview',
        types: ['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'],
        count: 10,
        lookbackHours: 24,
        prompt: '',
        saveDb: true
    });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-stone-900/80 z-[200] flex items-center justify-center p-4">
            <div className="bg-stone-50 border-4 border-stone-900 w-full max-w-2xl shadow-[8px_8px_0px_0px_#1A1C1C] flex flex-col max-h-[90vh]">
                <div className="bg-stone-900 text-white p-4 flex justify-between items-center">
                    <h2 className="font-black uppercase tracking-widest text-lg font-headline">Configurer le Scan</h2>
                    <button onClick={onClose} className="material-symbols-outlined hover:text-red-500">close</button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto font-label">
                    {/* Modèle */}
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Modèle IA</label>
                        <select 
                            value={scanConfig.model}
                            onChange={e => setScanConfig({...scanConfig, model: e.target.value})}
                            className="border-4 border-stone-900 bg-white p-3 font-bold uppercase text-xs focus:outline-none"
                        >
                            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                        </select>
                    </div>

                    {/* Types d'info */}
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Type d&apos;info autorisé</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'].map(type => (
                                <label key={type} className="flex items-center gap-3 border-4 border-stone-200 p-3 hover:border-stone-900 cursor-pointer transition-colors bg-white">
                                    <input 
                                        type="checkbox" 
                                        checked={scanConfig.types.includes(type)}
                                        onChange={e => {
                                            const newTypes = e.target.checked 
                                                ? [...scanConfig.types, type]
                                                : scanConfig.types.filter(t => t !== type);
                                            setScanConfig({...scanConfig, types: newTypes});
                                        }}
                                        className="w-5 h-5 accent-red-700" 
                                    />
                                    <span className="font-bold text-[10px] uppercase">{type}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Nombre d'articles */}
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex flex-col gap-2 flex-1">
                            <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Nombre d&apos;articles (Max)</label>
                            <input 
                                type="number" 
                                min="1" max="100"
                                value={scanConfig.count}
                                onChange={e => setScanConfig({...scanConfig, count: parseInt(e.target.value) || 10})}
                                className="border-4 border-stone-900 bg-white p-3 font-bold text-xs w-full focus:outline-none"
                            />
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Historique RSS/Telegram</label>
                            <select 
                                value={scanConfig.lookbackHours}
                                onChange={e => setScanConfig({...scanConfig, lookbackHours: parseInt(e.target.value) || 24})}
                                className="border-4 border-stone-900 bg-white p-3 font-bold uppercase text-xs focus:outline-none"
                            >
                                <option value="2">2 dernières heures</option>
                                <option value="6">6 dernières heures</option>
                                <option value="12">12 dernières heures</option>
                                <option value="24">24 dernières heures</option>
                                <option value="48">48 dernières heures (2 jours)</option>
                                <option value="168">168 dernières heures (7 jours)</option>
                            </select>
                        </div>
                    </div>

                    {/* Prompt Modifié */}
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Prompt Modifié (Optionnel)</label>
                        <textarea 
                            rows={4}
                            value={scanConfig.prompt}
                            onChange={e => setScanConfig({...scanConfig, prompt: e.target.value})}
                            placeholder="Surchargez ici le prompt standard..."
                            className="border-4 border-stone-900 p-3 text-xs w-full resize-y focus:outline-none font-mono"
                        />
                    </div>

                    {/* Sauvegarder en BDD */}
                    <label className="flex items-center gap-4 border-4 border-stone-900 p-4 bg-stone-100 cursor-pointer hover:bg-stone-200 transition-colors">
                        <input 
                            type="checkbox" 
                            checked={scanConfig.saveDb}
                            onChange={e => setScanConfig({...scanConfig, saveDb: e.target.checked})}
                            className="w-6 h-6 accent-red-700"
                        />
                        <span className="font-black text-[10px] sm:text-xs uppercase tracking-widest text-stone-900">
                            Sauvegarder en BDD (Sinon test Discord unique)
                        </span>
                    </label>
                </div>
                
                <div className="p-4 bg-stone-200 border-t-4 border-stone-900 flex justify-end gap-4 mt-auto">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-stone-600 hover:text-stone-900 transition-colors"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={() => onLaunch(scanConfig)}
                        className="bg-red-700 text-white px-8 py-3 font-black uppercase text-xs tracking-widest border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                    >
                        Lancer le Scan
                    </button>
                </div>
            </div>
        </div>
    );
}