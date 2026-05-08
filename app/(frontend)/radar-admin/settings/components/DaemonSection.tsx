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

export function DaemonSection({ form, updateForm }: DaemonSectionProps) {
    // Parse the schedule string into an object { LUN: ['08:00', '12:00'], ... }
    const parseSchedule = (raw: string) => {
        const schedule: Record<string, string[]> = {
            LUN: [], MAR: [], MER: [], JEU: [], VEN: [], SAM: [], DIM: []
        };
        if (!raw) return schedule;
        
        const lines = raw.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);
        lines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
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

    const [schedule, setSchedule] = useState<Record<string, string[]>>({});

    useEffect(() => {
        setSchedule(parseSchedule(form.daemonSchedule || ''));
    }, [form.daemonSchedule]);

    const updateSchedule = (newSchedule: Record<string, string[]>) => {
        setSchedule(newSchedule);
        updateForm('daemonSchedule', serializeSchedule(newSchedule));
    };

    const addTime = (day: string) => {
        const time = prompt('Ajouter une heure (format HH:MM)', '08:00');
        if (time && /^(\d{1,2}):(\d{2})$/.test(time)) {
            const newTimes = Array.from(new Set([...schedule[day], time])).sort();
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
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">Daemon & Chronos</h3>
                <p className="text-[11px] text-slate-500 font-medium italic">Configure the heartbeat and publication pacing of the Cortex.</p>
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
                                <h4 className="text-xs font-bold text-white uppercase tracking-widest">Auto-Publish Autopilot</h4>
                                <p className="text-[10px] text-zinc-400 font-medium">Automatic distribution of approved intelligence.</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => updateForm('enableAutoPublish', !form.enableAutoPublish)}
                            className={`w-12 h-6 rounded-full transition-all relative ${form.enableAutoPublish ? 'bg-emerald-500' : 'bg-zinc-800'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.enableAutoPublish ? 'left-7' : 'left-1'}`} />
                        </button>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 2. Scraping Control */}
                    <section className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-sm hover:border-slate-400 transition-all">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-slate-400 text-sm">sync</span>
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Scraping Pulse</h4>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold text-slate-400 uppercase">Interval (Minutes)</label>
                            <input 
                                type="number"
                                value={form.scrapingInterval || 60}
                                onChange={(e) => updateForm('scrapingInterval', parseInt(e.target.value))}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:bg-white focus:border-black transition-all"
                            />
                        </div>
                    </section>

                    {/* 3. Publication Delays */}
                    <section className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4 shadow-sm hover:border-slate-400 transition-all">
                        <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-slate-400 text-sm">timer</span>
                            <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Publication Pacing</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Min Delay (m)</label>
                                <input 
                                    type="number"
                                    value={form.minPublishDelay || 60}
                                    onChange={(e) => updateForm('minPublishDelay', parseInt(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:bg-white focus:border-black transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Max Delay (m)</label>
                                <input 
                                    type="number"
                                    value={form.maxPublishDelay || 120}
                                    onChange={(e) => updateForm('maxPublishDelay', parseInt(e.target.value))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-xs font-bold outline-none focus:bg-white focus:border-black transition-all"
                                />
                            </div>
                        </div>
                    </section>
                </div>

                {/* 4. Weekly Scheduling Matrix */}
                <section className="space-y-6 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-slate-400">calendar_month</span>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Weekly Scheduling Matrix</h4>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {DAYS.map(day => (
                            <div key={day.key} className="p-4 bg-slate-50 rounded-xl border border-slate-100 group hover:bg-white hover:border-slate-300 transition-all">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-tighter">{day.label}</span>
                                    <button 
                                        onClick={() => addTime(day.key)}
                                        className="w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-black hover:text-white transition-all shadow-sm"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">add</span>
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1.5 min-h-[30px]">
                                    {schedule[day.key]?.map(time => (
                                        <div 
                                            key={time}
                                            className="px-2 py-1 bg-white border border-slate-200 rounded-md text-[9px] font-black flex items-center gap-1 group/item hover:border-red-200"
                                        >
                                            {time}
                                            <button 
                                                onClick={() => removeTime(day.key, time)}
                                                className="opacity-0 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                                            >
                                                <span className="material-symbols-outlined text-[12px]">close</span>
                                            </button>
                                        </div>
                                    ))}
                                    {(!schedule[day.key] || schedule[day.key].length === 0) && (
                                        <span className="text-[9px] text-slate-300 italic">No slots</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
