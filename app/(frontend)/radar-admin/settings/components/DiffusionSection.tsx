'use client';

import React from 'react';

interface DiffusionSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

const PLATFORMS = [
    { id: 'enableDiscord', mode: 'discordPublishMode', label: 'Discord' },
    { id: 'enableX', mode: 'xPublishMode', label: 'X (Twitter)' },
    { id: 'enableBluesky', mode: 'blueskyPublishMode', label: 'Bluesky' },
    { id: 'enableMastodon', mode: 'enableMastodon', label: 'Mastodon' },
    { id: 'enablePayloadCMS', mode: 'enablePayloadCMS', label: 'Payload CMS' },
];

export function DiffusionSection({ form, updateForm }: DiffusionSectionProps) {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-black">Social matrix</h3>
                <span className="text-[10px] text-slate-400 font-mono italic">Payload distribution routing</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {PLATFORMS.map((p) => (
                    <div 
                        key={p.id}
                        className={`p-3 rounded-sm border transition-all ${
                            form[p.id] ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[11px] font-bold text-black">{p.label}</span>
                            <button 
                                onClick={() => updateForm(p.id, !form[p.id])}
                                className={`w-6 h-3.5 rounded-full relative transition-all ${form[p.id] ? 'bg-black' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all ${form[p.id] ? 'left-3' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {form[p.id] && p.mode && (
                            <div className="flex gap-1 pt-2 border-t border-slate-50">
                                {['DIRECT', 'SCHEDULED'].map(m => (
                                    <button 
                                        key={m}
                                        onClick={() => updateForm(p.mode, m)}
                                        className={`flex-1 py-1 text-[9px] font-bold rounded-sm border transition-all ${
                                            form[p.mode] === m 
                                                ? 'bg-slate-900 text-white border-slate-900' 
                                                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
                                        }`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
