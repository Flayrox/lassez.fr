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
    const HOURS = Array.from({ length: 24 }).map((_, i) => `${i.toString().padStart(2, '0')}:00`);
    
    // Parse l'ancien format string en un Set de "JOUR-HEURE" pour le rendu O(1)
    const parseToSet = (raw: string) => {
        const selected = new Set<string>();
        if (!raw) return selected;
        const lines = raw.split(/[\n;]+/).map(l => l.trim()).filter(Boolean);
        lines.forEach(line => {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
                const days = parts[0].toUpperCase().split(',');
                const time = parts[1]; // Format attendu: HH:00
                days.forEach(d => selected.add(`${d.trim()}-${time}`));
            }
        });
        return selected;
    };

    // Reconvertit le Set en string pour le backend
    const serializeFromSet = (selected: Set<string>) => {
        const schedule: Record<string, string[]> = {
            LUN: [], MAR: [], MER: [], JEU: [], VEN: [], SAM: [], DIM: []
        };
        selected.forEach(entry => {
            const [day, time] = entry.split('-');
            if (schedule[day]) schedule[day].push(time);
        });
        
        return Object.entries(schedule)
            .filter(([_, times]) => times.length > 0)
            .map(([day, times]) => times.sort().map(t => `${day} ${t}`).join('\n'))
            .join('\n');
    };

    const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
    
    // Rectangle Selection State
    const [dragStart, setDragStart] = useState<{ dayIdx: number, hourIdx: number } | null>(null);
    const [dragCurrent, setDragCurrent] = useState<{ dayIdx: number, hourIdx: number } | null>(null);
    const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);

    useEffect(() => {
        setSelectedSlots(parseToSet(form.daemonSchedule || ''));
    }, [form.daemonSchedule]);

    const handleSave = (newSlots: Set<string>) => {
        setSelectedSlots(newSlots);
        updateForm('daemonSchedule', serializeFromSet(newSlots));
    };

    const handleMouseDown = (dayIdx: number, hourIdx: number) => {
        const slotKey = `${DAYS[dayIdx].key}-${HOURS[hourIdx]}`;
        const mode = selectedSlots.has(slotKey) ? 'remove' : 'add';
        setDragMode(mode);
        setDragStart({ dayIdx, hourIdx });
        setDragCurrent({ dayIdx, hourIdx });
    };

    const handleMouseEnter = (dayIdx: number, hourIdx: number) => {
        if (dragStart) {
            setDragCurrent({ dayIdx, hourIdx });
        }
    };

    useEffect(() => {
        const handleMouseUp = () => {
            if (dragStart && dragCurrent && dragMode) {
                const minDay = Math.min(dragStart.dayIdx, dragCurrent.dayIdx);
                const maxDay = Math.max(dragStart.dayIdx, dragCurrent.dayIdx);
                const minHour = Math.min(dragStart.hourIdx, dragCurrent.hourIdx);
                const maxHour = Math.max(dragStart.hourIdx, dragCurrent.hourIdx);

                const newSlots = new Set(selectedSlots);

                for (let d = minDay; d <= maxDay; d++) {
                    for (let h = minHour; h <= maxHour; h++) {
                        const slotKey = `${DAYS[d].key}-${HOURS[h]}`;
                        if (dragMode === 'add') {
                            newSlots.add(slotKey);
                        } else {
                            newSlots.delete(slotKey);
                        }
                    }
                }

                handleSave(newSlots);
            }
            setDragStart(null);
            setDragCurrent(null);
            setDragMode(null);
        };

        window.addEventListener('mouseup', handleMouseUp);
        return () => window.removeEventListener('mouseup', handleMouseUp);
    }, [dragStart, dragCurrent, dragMode, selectedSlots]);

    const isSlotInDragRange = (dayIdx: number, hourIdx: number) => {
        if (!dragStart || !dragCurrent) return false;
        const minDay = Math.min(dragStart.dayIdx, dragCurrent.dayIdx);
        const maxDay = Math.max(dragStart.dayIdx, dragCurrent.dayIdx);
        const minHour = Math.min(dragStart.hourIdx, dragCurrent.hourIdx);
        const maxHour = Math.max(dragStart.hourIdx, dragCurrent.hourIdx);
        return dayIdx >= minDay && dayIdx <= maxDay && hourIdx >= minHour && hourIdx <= maxHour;
    };

    const clearSchedule = () => {
        if (confirm('Voulez-vous effacer toute la planification ?')) {
            handleSave(new Set());
        }
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

            <div className="pt-6 space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h4 className="text-[12px] font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                            Interactive Schedule Matrix
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">Click and drag to select scanning hours (Calendly style).</p>
                    </div>
                    <button onClick={clearSchedule} className="text-[10px] font-bold text-red-500 hover:text-white transition-all bg-red-50 hover:bg-red-500 px-3 py-1.5 rounded-md border border-red-100 shadow-sm">
                        Clear all
                    </button>
                </div>
                
                {/* Drag to select Calendar Grid */}
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm select-none">
                    {/* Header Row (Days) */}
                    <div className="flex border-b border-slate-200 bg-slate-50">
                        <div className="w-16 shrink-0 border-r border-slate-200"></div>
                        {DAYS.map(day => (
                            <div key={day.key} className="flex-1 text-center py-2 border-r border-slate-200 last:border-r-0">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">{day.label}</span>
                            </div>
                        ))}
                    </div>
                    
                    {/* Time Rows */}
                    <div className="max-h-[400px] overflow-y-auto custom-scrollbar relative bg-white">
                        {HOURS.map((hour, hourIdx) => (
                            <div key={hour} className="flex border-b border-slate-100 last:border-b-0 group">
                                <div className="w-16 shrink-0 border-r border-slate-200 py-1 flex items-center justify-center bg-slate-50 z-10 sticky left-0">
                                    <span className="text-[9px] font-mono text-slate-400 group-hover:text-black transition-colors">{hour}</span>
                                </div>
                                {DAYS.map((day, dayIdx) => {
                                    const slotKey = `${day.key}-${hour}`;
                                    const isSelected = selectedSlots.has(slotKey);
                                    const inRange = isSlotInDragRange(dayIdx, hourIdx);
                                    const effectivelySelected = inRange ? dragMode === 'add' : isSelected;
                                    const isActivelyChanging = inRange; // To apply a pulse/highlight during drag

                                    return (
                                        <div 
                                            key={slotKey}
                                            onMouseDown={() => handleMouseDown(dayIdx, hourIdx)}
                                            onMouseEnter={() => handleMouseEnter(dayIdx, hourIdx)}
                                            className={`flex-1 border-r border-slate-100/50 last:border-r-0 cursor-crosshair transition-all duration-75 select-none ${
                                                effectivelySelected 
                                                    ? 'bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.15)]' 
                                                    : 'bg-transparent hover:bg-slate-100/50'
                                            } ${isActivelyChanging ? 'opacity-80 scale-[0.98]' : ''}`}
                                        >
                                            <div className="h-6 w-full flex items-center justify-center">
                                                {effectivelySelected && (
                                                    <span className={`material-symbols-outlined text-[14px] ${isActivelyChanging ? 'text-white/60' : 'text-white/90'}`}>
                                                        check
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
