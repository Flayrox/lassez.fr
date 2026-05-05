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
                {/* 1. Global Activation */}
                <section className="p-6 bg-black rounded-2xl border border-black space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center">
                                <span className="material-symbols-outlined text-white">bolt</span>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Cortex Autopilot</h4>
                                <p className="text-[10px] text-zinc-400">Statut global du moteur de scan.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => updateForm('daemon_rss_enabled', form.daemon_rss_enabled === 'true' ? 'false' : 'true')}
                            className={`w-14 h-7 rounded-full transition-all relative ${form.daemon_rss_enabled === 'true' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-zinc-800'}`}
                        >
                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${form.daemon_rss_enabled === 'true' ? 'left-8' : 'left-1'}`} />
                        </button>
                    </div>
                </section>

                {/* 2. Expert Schedule Table */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Weekly Operation Windows</h4>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-[9px] font-bold text-slate-400 uppercase">Schedule Mode</span>
                             <button 
                                onClick={() => updateForm('daemon_rss_schedule_enabled', form.daemon_rss_schedule_enabled === 'true' ? 'false' : 'true')}
                                className={`w-10 h-5 rounded-full transition-all relative ${form.daemon_rss_schedule_enabled === 'true' ? 'bg-black' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${form.daemon_rss_schedule_enabled === 'true' ? 'left-5.5' : 'left-0.5'}`} />
                            </button>
                        </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100">
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-tighter w-32">Jour</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-tighter">Créneaux de Scan</th>
                                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-tighter w-20 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {DAYS.map((day) => (
                                    <tr key={day.key} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{day.label}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {schedule[day.key].length > 0 ? (
                                                    schedule[day.key].map((time) => (
                                                        <div 
                                                            key={time} 
                                                            className="group flex items-center gap-2 px-2.5 py-1 bg-slate-100 text-black rounded-md border border-slate-200 hover:border-black transition-all"
                                                        >
                                                            <span className="text-[11px] font-black font-mono">{time}</span>
                                                            <button 
                                                                onClick={() => removeTime(day.key, time)}
                                                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">close</span>
                                                            </button>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <span className="text-[10px] text-slate-300 italic font-medium">Aucun scan planifié</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button 
                                                onClick={() => addTime(day.key)}
                                                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-black hover:text-white transition-all group"
                                            >
                                                <span className="material-symbols-outlined text-[18px]">add</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* 3. AI Agent Logic & Tools */}
                <section className="space-y-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-slate-400">smart_toy</span>
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agent Configuration & Matrix Tools</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Researcher */}
                        <div className="p-5 border border-slate-200 rounded-2xl space-y-4 hover:border-slate-400 transition-all">
                            <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black uppercase rounded">Researcher</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="material-symbols-outlined text-emerald-500 text-[14px]">public</span>
                                    <span className="text-[9px] font-bold text-emerald-600 uppercase">Google Search ON</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Agent Model</label>
                                <select 
                                    value={form.ai_model_breaking || 'gemini-3.1-pro-preview'} 
                                    onChange={e => updateForm('ai_model_breaking', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-slate-100"
                                >
                                    {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-tight">Spécialisé dans le fact-checking profond et le passif OSINT.</p>
                        </div>

                        {/* Editor */}
                        <div className="p-5 border border-slate-200 rounded-2xl space-y-4 hover:border-slate-400 transition-all">
                            <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[9px] font-black uppercase rounded">Editor</span>
                                <div className="flex items-center gap-1.5 opacity-40">
                                    <span className="material-symbols-outlined text-slate-400 text-[14px]">public_off</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Search Off</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Agent Model</label>
                                <select 
                                    value={form.ai_model_main || 'gemini-3-flash-preview'} 
                                    onChange={e => updateForm('ai_model_main', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-slate-100"
                                >
                                    {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-tight">Rédaction incisive au style "L'Assez" basée sur le contexte fourni.</p>
                        </div>

                        {/* Validator */}
                        <div className="p-5 border border-slate-200 rounded-2xl space-y-4 hover:border-slate-400 transition-all">
                            <div className="flex justify-between items-start">
                                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase rounded">Validator</span>
                                <div className="flex items-center gap-1.5 opacity-40">
                                    <span className="material-symbols-outlined text-slate-400 text-[14px]">public_off</span>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">Search Off</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Agent Model</label>
                                <select 
                                    value={form.ai_model_validator || 'gemini-3.1-flash-lite-preview'} 
                                    onChange={e => updateForm('ai_model_validator', e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold font-mono outline-none focus:ring-2 focus:ring-slate-100"
                                >
                                    {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <p className="text-[9px] text-slate-400 leading-tight">Vérification des hallucinations et du formatage JSON.</p>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
}
