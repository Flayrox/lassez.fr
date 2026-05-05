'use client';

import React from 'react';

interface SourcesSectionProps {
    form: any;
    updateForm: (key: string, val: any) => void;
}

export function SourcesSection({ form, updateForm }: SourcesSectionProps) {
    const parseList = (jsonStr: string) => {
        try { return JSON.parse(jsonStr || '[]').join('\n'); } catch { return ''; }
    };

    const updateList = (key: string, val: string) => {
        const arr = val.split('\n').map(l => l.trim()).filter(Boolean);
        updateForm(key, JSON.stringify(arr));
    };

    return (
        <div className="space-y-10">
            <div>
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-900 mb-1">Source Management</h3>
                <p className="text-[11px] text-slate-500 font-medium">Configure where the OSINT engine pulls data from.</p>
            </div>

            <div className="grid gap-8">
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">rss_feed</span>
                            RSS Feeds
                        </label>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded border border-orange-100">Standard Atom/RSS</span>
                    </div>
                    <textarea 
                        value={parseList(form.rss_feeds)}
                        onChange={e => updateList('rss_feeds', e.target.value)}
                        rows={6}
                        placeholder="https://example.com/feed.xml"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs focus:ring-2 focus:ring-slate-100 focus:border-slate-400 outline-none transition-all"
                    />
                </section>

                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm">send</span>
                            Telegram Channels
                        </label>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">Scraper Mode</span>
                    </div>
                    <textarea 
                        value={parseList(form.telegram_channels)}
                        onChange={e => {
                            const arr = e.target.value.split('\n').map(l => l.trim().replace(/^@/, '')).filter(Boolean);
                            updateForm('telegram_channels', JSON.stringify(arr));
                        }}
                        rows={6}
                        placeholder="ChannelHandle (without @)"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs focus:ring-2 focus:ring-slate-100 focus:border-slate-400 outline-none transition-all"
                    />
                </section>

                <section className="space-y-6 pt-6 border-t border-slate-100">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">close</span>
                                X / Twitter (via RSS-Bridge)
                            </label>
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-slate-900 text-white rounded">Bridge Required</span>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase">Bridge Base URL</p>
                            <input 
                                type="text" 
                                value={form.rss_bridge_base_url || ''} 
                                onChange={e => updateForm('rss_bridge_base_url', e.target.value)}
                                placeholder="http://localhost:3300"
                                className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs font-mono focus:ring-2 focus:ring-slate-100 focus:border-slate-400 outline-none transition-all"
                            />
                        </div>

                        <textarea 
                            value={parseList(form.x_accounts)}
                            onChange={e => {
                                const arr = e.target.value.split('\n').map(l => l.trim().replace(/^@/, '')).filter(Boolean);
                                updateForm('x_accounts', JSON.stringify(arr));
                            }}
                            rows={6}
                            placeholder="Username"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-xs focus:ring-2 focus:ring-slate-100 focus:border-slate-400 outline-none transition-all"
                        />
                    </div>
                </section>
            </div>
        </div>
    );
}
