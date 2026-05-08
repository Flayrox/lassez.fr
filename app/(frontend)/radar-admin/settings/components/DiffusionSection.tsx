'use client';

import React from 'react';

interface DiffusionSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

const PLATFORMS = [
    { id: 'enableDiscord', mode: 'discordPublishMode', label: 'Discord', icon: 'forum', color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { id: 'enableX', mode: 'xPublishMode', label: 'X (Twitter)', icon: 'brand_family', color: 'text-slate-900', bg: 'bg-slate-50' },
    { id: 'enableBluesky', mode: 'blueskyPublishMode', label: 'Bluesky', icon: 'cloud', color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'enableMastodon', mode: 'enableMastodon', label: 'Mastodon', icon: 'share', color: 'text-purple-500', bg: 'bg-purple-50' },
    { id: 'enablePayloadCMS', mode: 'enablePayloadCMS', label: 'Payload CMS', icon: 'article', color: 'text-emerald-500', bg: 'bg-emerald-50' },
];

export function DiffusionSection({ form, updateForm }: DiffusionSectionProps) {
    return (
        <div className="space-y-10">
            <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-1">Social Matrix</h3>
                <p className="text-[11px] text-slate-500 font-medium italic">Configure the cross-platform distribution of your investigative payloads.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {PLATFORMS.map((p) => (
                    <div 
                        key={p.id}
                        className={`p-6 rounded-2xl border transition-all ${
                            form[p.id] ? 'bg-white border-slate-300 shadow-md' : 'bg-slate-50/50 border-slate-100 opacity-60'
                        }`}
                    >
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center`}>
                                    <span className={`material-symbols-outlined ${p.color}`}>{p.icon}</span>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">{p.label}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                        {form[p.id] ? 'Connection Active' : 'Offline'}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => updateForm(p.id, !form[p.id])}
                                className={`w-10 h-5 rounded-full transition-all relative ${form[p.id] ? 'bg-black' : 'bg-slate-300'}`}
                            >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${form[p.id] ? 'left-6' : 'left-1'}`} />
                            </button>
                        </div>

                        {form[p.id] && p.mode && (
                            <div className="space-y-4 pt-4 border-t border-slate-50">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Publishing Strategy</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => updateForm(p.mode, 'DIRECT')}
                                        className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                                            form[p.mode] === 'DIRECT' 
                                                ? 'bg-black text-white border-black' 
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                        }`}
                                    >
                                        DIRECT
                                    </button>
                                    <button 
                                        onClick={() => updateForm(p.mode, 'SCHEDULED')}
                                        className={`px-3 py-2 rounded-lg text-[10px] font-bold transition-all border ${
                                            form[p.mode] === 'SCHEDULED' 
                                                ? 'bg-black text-white border-black' 
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                        }`}
                                    >
                                        SCHEDULED
                                    </button>
                                </div>
                                <p className="text-[9px] text-slate-400 italic">
                                    {form[p.mode] === 'DIRECT' 
                                        ? 'Posts will be published immediately after approval.' 
                                        : 'Posts will be queued according to the daemon schedule.'}
                                </p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
