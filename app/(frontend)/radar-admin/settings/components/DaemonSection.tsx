'use client';

import React, { useState, useEffect } from 'react';

interface DaemonSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

const DAYS = [
    { key: 'LUN', label: 'Lundi' },
    { key: 'MAR', label: 'Mardi' },
    { key: 'MER', label: 'Mercredi' },
    { key: 'JEU', label: 'Jeudi' },
    { key: 'VEN', label: 'Vendredi' },
    { key: 'SAM', label: 'Samedi' },
    { key: 'DIM', label: 'Dimanche' },
];

const MODELS = [
    'gemini-3.1-pro-preview',
    'gemini-3-flash-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-2.0-pro-exp',
    'gemini-1.5-pro',
];

export function DaemonSection({ form, updateForm }: DaemonSectionProps) {
    // Parse the schedule string into an object { LUN: ['08:00', '12:00'], ... }
    const parseSchedule = (raw: string) => {
        const schedule: Record<string, string[]> = {
            LUN: [], MAR: [], MER: [], JEU: [], VEN: [], SAM: [], DIM: []
        };
        const lines = raw.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);
        
        lines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length === 1) {
                // Time only (apply to all days if you want, or just skip. Let's assume daily)
                const time = parts[0];
                Object.keys(schedule).forEach(d => schedule[d].push(time));
            } else {
                const days = parts[0].toUpperCase().split(',');
                const time = parts[1];
                days.forEach(d => {
                    const cleanD = d.trim();
                    if (schedule[cleanD]) schedule[cleanD].push(time);
                });
            }
        });
        return schedule;
    };

    const serializeSchedule = (obj: Record<string, string[]>) => {
        return Object.entries(obj)
            .filter(([_, times]) => times.length > 0)
            .map(([day, times]) => times.map(t => `${day} ${t}`).join('\n'))
            .join('\n');
    };

    const [schedule, setSchedule] = useState<Record<string, string[]>>(parseSchedule(form.daemon_rss_schedule_times || ''));

    // Update form when internal schedule changes
    const updateSchedule = (newSchedule: Record<string, string[]>) => {
        setSchedule(newSchedule);
        updateForm('daemon_rss_schedule_times', serializeSchedule(newSchedule));
    };

    const addTime = (day: string) => {
        const time = prompt('Ajouter une heure (format HH:MM)', '08:00');
        if (time && /^(\d{1,2}):(\d{2})$/.test(time)) {
            const newTimes = [...schedule[day], time].sort();
            updateSchedule({ ...schedule, [day]: newTimes });
        }
    };

    const removeTime = (day: string, time: string) => {
        const newTimes = schedule[day].filter(t => t !== time);
        updateSchedule({ ...schedule, [day]: newTimes });
    };

    return (
        <div className="space-y-10">
            <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-1">Daemon & Scheduling</h3>
                <p className="text-[11px] text-slate-500 font-medium">L'intelligence industrielle au service de votre emploi du temps.</p>
            </div>

            <div className="grid gap-8">
                {/* 1. Global Activation - AUTO PUBLISH */}
                <section className="p-6 bg-black rounded-2xl border border-black space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">rocket_launch</span>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Auto-Publish Pilot</h4>
                                <p className="text-[10px] text-zinc-400">Diffusion automatique des articles approuvés.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => updateForm('enableAutoPublish', !form.enableAutoPublish)}
                            className={`w-14 h-7 rounded-full transition-all relative ${form.enableAutoPublish ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-zinc-800'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${form.enableAutoPublish ? 'left-8' : 'left-1'}`} />
                        </button>
                    </div>
                </section>

                {/* 2. Scraping Control */}
                <section className="p-6 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100">
                                <span className="material-symbols-outlined text-slate-900">sync</span>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Cortex Heartbeat</h4>
                                <p className="text-[10px] text-slate-400">Intervalle de scan des sources (minutes).</p>
                            </div>
                        </div>
                        <input 
                            type="number"
                            value={form.scrapingInterval || 60}
                            onChange={(e) => updateForm('scrapingInterval', parseInt(e.target.value))}
                            className="w-20 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold text-center outline-none focus:ring-2 focus:ring-slate-100"
                        />
                    </div>
                </section>

                {/* 3. AI Agent Logic & Tools */}
                <section className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-slate-400">smart_toy</span>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent Configuration & Matrix Tools</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Researcher (Flash) */}
                        <div className="p-5 border border-slate-200 rounded-2xl space-y-4 hover:border-slate-400 transition-all">
                            <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded">Researcher (Flash)</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-[14px]">bolt</span>
                                    <span className="text-[9px] font-bold text-emerald-600 uppercase">IA Rapide</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Agent Model</label>
                                <select 
                                    value={form.aiModelFlash || 'gemini-1.5-flash'} 
                                    onChange={e => updateForm('aiModelFlash', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-slate-100"
                                >
                                    {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Editorialist (Pro) */}
                        <div className="p-5 border border-slate-200 rounded-2xl space-y-4 hover:border-slate-400 transition-all">
                            <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-black uppercase rounded">Editorialist (Pro)</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-purple-500 text-[14px]">edit_note</span>
                                    <span className="text-[9px] font-bold text-purple-600 uppercase">IA Rédactionnelle</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Agent Model</label>
                                <select 
                                    value={form.aiModelPro || 'gemini-1.5-pro'} 
                                    onChange={e => updateForm('aiModelPro', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-slate-100"
                                >
                                    {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
