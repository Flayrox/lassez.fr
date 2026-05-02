'use client';

import React, { useState, useEffect } from 'react';

interface DaemonRssConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: any;
    onSave: (config: any) => Promise<void>;
}

export function DaemonRssConfigModal({ isOpen, onClose, settings, onSave }: DaemonRssConfigModalProps) {
    const [scanConfig, setScanConfig] = useState({
        daemon_rss_model: 'gemini-3.1-pro-preview',
        daemon_rss_types: ['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'],
        daemon_rss_max_articles: 10,
        daemon_rss_lookback_hours: 24,
        daemon_rss_prompt: '',
        scan_interval_hours: 2,
        daemon_rss_interval_enabled: true,
        daemon_rss_schedule_enabled: false,
        daemon_rss_schedule_times: '08:00, 12:00, 18:00',
    });

    useEffect(() => {
        if (settings) {
            let parsedTypes = ['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'];
            try { if (settings.daemon_rss_types) parsedTypes = JSON.parse(settings.daemon_rss_types); } catch (e) {}

            setScanConfig({
                daemon_rss_model: settings.daemon_rss_model || 'gemini-3.1-pro-preview',
                daemon_rss_types: parsedTypes,
                daemon_rss_max_articles: parseInt(settings.daemon_rss_max_articles || settings.max_articles || '10', 10),
                daemon_rss_lookback_hours: parseInt(settings.daemon_rss_lookback_hours || settings.rss_lookback_hours || '24', 10),
                daemon_rss_prompt: settings.daemon_rss_prompt || '',
                scan_interval_hours: parseFloat(settings.scan_interval_hours || '2'),
                daemon_rss_interval_enabled: settings.daemon_rss_interval_enabled !== 'false',
                daemon_rss_schedule_enabled: settings.daemon_rss_schedule_enabled === 'true',
                daemon_rss_schedule_times: settings.daemon_rss_schedule_times || '08:00, 12:00, 18:00',
            });
        }
    }, [settings]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-stone-900/80 z-[200] flex items-center justify-center p-4">
            <div className="bg-stone-50 border-4 border-stone-900 w-full max-w-2xl shadow-[8px_8px_0px_0px_#1A1C1C] flex flex-col max-h-[90vh]">
                <div className="bg-stone-900 text-white p-4 flex justify-between items-center">
                    <h2 className="font-black uppercase tracking-widest text-lg font-headline">Configurer le DAEMON RSS</h2>
                    <button onClick={onClose} className="material-symbols-outlined hover:text-red-500">close</button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto font-label">
                    {/* Modèle */}
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Modèle IA du Daemon</label>
                        <select 
                            value={scanConfig.daemon_rss_model}
                            onChange={e => setScanConfig({...scanConfig, daemon_rss_model: e.target.value})}
                            className="border-4 border-stone-900 bg-white p-3 font-bold uppercase text-xs focus:outline-none"
                        >
                            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Recommandé)</option>
                            <option value="gemini-3.1-flash-lite-preview">gemini-3.1-flash-lite-preview</option>
                            <option value="gemini-3-flash-preview">gemini-3-flash-preview</option>
                            <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                            <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                        </select>
                    </div>

                    {/* Types d'info */}
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Type d'info autorisé en Automatique</label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {['🔴 ALERTE INFO !', '📌 LE FAIT DU JOUR', '🔎 DÉCRYPTAGE', '🗓️ À VENIR'].map(type => (
                                <label key={type} className="flex items-center gap-3 border-4 border-stone-200 p-3 hover:border-stone-900 cursor-pointer transition-colors bg-white">
                                    <input 
                                        type="checkbox" 
                                        checked={scanConfig.daemon_rss_types.includes(type)}
                                        onChange={e => {
                                            const newTypes = e.target.checked 
                                                ? [...scanConfig.daemon_rss_types, type]
                                                : scanConfig.daemon_rss_types.filter(t => t !== type);
                                            setScanConfig({...scanConfig, daemon_rss_types: newTypes});
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
                            <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Nombre d'articles (Max)</label>
                            <input 
                                type="number" 
                                min="1" max="100"
                                value={scanConfig.daemon_rss_max_articles}
                                onChange={e => setScanConfig({...scanConfig, daemon_rss_max_articles: parseInt(e.target.value) || 10})}
                                className="border-4 border-stone-900 bg-white p-3 font-bold text-xs w-full focus:outline-none"
                            />
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Historique RSS/Telegram</label>
                            <select 
                                value={scanConfig.daemon_rss_lookback_hours}
                                onChange={e => setScanConfig({...scanConfig, daemon_rss_lookback_hours: parseInt(e.target.value) || 24})}
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

                    {/* Planification (Schedule & Interval) */}
                    <div className="flex flex-col gap-4 border-4 border-stone-200 p-4 bg-stone-100">
                        <label className="font-black text-sm uppercase tracking-widest text-stone-900 border-b-2 border-stone-300 pb-2">
                            Planification du Scan
                        </label>
                        
                        <div className="flex flex-col gap-4">
                            {/* Intervalle */}
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={scanConfig.daemon_rss_interval_enabled}
                                        onChange={e => setScanConfig({...scanConfig, daemon_rss_interval_enabled: e.target.checked})}
                                        className="w-5 h-5 accent-red-700" 
                                    />
                                    <span className="font-bold text-xs uppercase text-stone-600">Activer l'intervalle fixe</span>
                                </label>
                                {scanConfig.daemon_rss_interval_enabled && (
                                    <div className="ml-8 flex items-center gap-2">
                                        <label className="font-bold text-xs uppercase tracking-widest text-stone-500">Toutes les (h):</label>
                                        <input 
                                            type="number" 
                                            step="0.5" min="0.5"
                                            value={scanConfig.scan_interval_hours}
                                            onChange={e => setScanConfig({...scanConfig, scan_interval_hours: parseFloat(e.target.value) || 2})}
                                            className="border-2 border-stone-900 bg-white p-2 font-bold text-xs w-24 focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Heures Fixes */}
                            <div className="flex flex-col gap-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={scanConfig.daemon_rss_schedule_enabled}
                                        onChange={e => setScanConfig({...scanConfig, daemon_rss_schedule_enabled: e.target.checked})}
                                        className="w-5 h-5 accent-red-700" 
                                    />
                                    <span className="font-bold text-xs uppercase text-stone-600">Activer les heures programmées</span>
                                </label>
                                {scanConfig.daemon_rss_schedule_enabled && (
                                    <div className="ml-8 flex flex-col gap-2">
                                        <label className="font-bold text-[10px] uppercase tracking-widest text-stone-500">
                                            Heures (séparées par des virgules, ex: 08:30, 14:00)
                                        </label>
                                        <input 
                                            type="text" 
                                            value={scanConfig.daemon_rss_schedule_times}
                                            onChange={e => setScanConfig({...scanConfig, daemon_rss_schedule_times: e.target.value})}
                                            placeholder="08:00, 12:00, 18:00"
                                            className="border-2 border-stone-900 bg-white p-2 font-bold text-xs w-full focus:outline-none"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Prompt Modifié */}
                    <div className="flex flex-col gap-2">
                        <label className="font-bold text-xs uppercase tracking-widest text-stone-600">Prompt Modifié Automatique</label>
                        <textarea 
                            rows={4}
                            value={scanConfig.daemon_rss_prompt}
                            onChange={e => setScanConfig({...scanConfig, daemon_rss_prompt: e.target.value})}
                            placeholder="Surchargez ici le prompt standard... S'il est vide, le cerveau du systeme prendra le relai."
                            className="border-4 border-stone-900 p-3 text-xs w-full resize-y focus:outline-none font-mono"
                        />
                    </div>
                </div>
                
                <div className="p-4 bg-stone-200 border-t-4 border-stone-900 flex justify-end gap-4 mt-auto">
                    <button 
                        onClick={onClose}
                        className="px-6 py-3 font-bold uppercase text-xs tracking-widest text-stone-600 hover:text-stone-900 transition-colors"
                    >
                        Annuler
                    </button>
                    <button 
                        onClick={() => {
                            onSave(scanConfig);
                            onClose();
                        }}
                        className="bg-stone-900 text-white px-8 py-3 font-black uppercase text-xs tracking-widest border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                    >
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
}