'use client';

import React, { useState, useEffect } from 'react';

interface DaemonSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

const DAYS = [
    { key: 'LUN', label: 'Lun' },
    { key: 'MAR', label: 'Mar' },
    { key: 'MER', label: 'Mer' },
    { key: 'JEU', label: 'Jeu' },
    { key: 'VEN', label: 'Ven' },
    { key: 'SAM', label: 'Sam' },
    { key: 'DIM', label: 'Dim' },
];

export function DaemonSection({ form, updateForm }: DaemonSectionProps) {
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
        const time = prompt('Format HH:MM', '08:00');
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
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-black">Daemon & Chronos</h3>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">Autopilot</span>
                    <button 
                        onClick={() => updateForm('enableAutoPublish', !form.enableAutoPublish)}
                        className={`w-6 h-3.5 rounded-full relative transition-all ${form.enableAutoPublish ? 'bg-black' : 'bg-slate-200'}`}
                    >
                        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${form.enableAutoPublish ? 'left-3' : 'left-0.5'}`} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400">Scraping pulse (min)</label>
                    <input type="number" value={form.scrapingInterval || 60} onChange={(e) => updateForm('scrapingInterval', parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-mono font-bold focus:border-black outline-none transition-all" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400">Min delay (min)</label>
                    <input type="number" value={form.minPublishDelay || 60} onChange={(e) => updateForm('minPublishDelay', parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-mono font-bold focus:border-black outline-none transition-all" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400">Max delay (min)</label>
                    <input type="number" value={form.maxPublishDelay || 120} onChange={(e) => updateForm('maxPublishDelay', parseInt(e.target.value))} className="w-full bg-white border border-slate-200 rounded-sm px-2 py-1 text-[11px] font-mono font-bold focus:border-black outline-none transition-all" />
                </div>
            </div>

            <div className="pt-4 space-y-3">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Weekly schedule matrix</h4>
                <div className="grid grid-cols-7 gap-1">
                    {DAYS.map(day => (
                        <div key={day.key} className="border border-slate-100 rounded-sm bg-slate-50/50 p-2 min-h-[80px] flex flex-col gap-2">
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-bold text-black">{day.label}</span>
                                <button onClick={() => addTime(day.key)} className="text-slate-400 hover:text-black transition-all">
                                    <span className="material-symbols-outlined text-[14px]">add</span>
                                </button>
                            </div>
                            <div className="flex flex-col gap-1">
                                {schedule[day.key]?.map(time => (
                                    <div key={time} className="px-1 py-0.5 bg-white border border-slate-200 rounded-sm text-[9px] font-mono flex justify-between items-center group">
                                        {time}
                                        <button onClick={() => removeTime(day.key, time)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                                            <span className="material-symbols-outlined text-[10px]">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
