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
        { id: 'enableMastodon', mode: 'mastodonPublishMode', label: 'Mastodon' },
        { id: 'enablePayloadCMS', mode: 'payloadPublishMode', label: 'Payload CMS' },
    ];

export function DiffusionSection({ form, updateForm }: DiffusionSectionProps) {
    const renderApiFields = (platformId: string) => {
        if (!form[platformId]) return null;

        switch (platformId) {
            case 'enableDiscord':
                return (
                    <div className="grid grid-cols-[150px_1fr] items-center gap-4 py-3 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Webhook URL</label>
                        <input type="password" value={form.discordWebhookUrl || ''} onChange={(e) => updateForm('discordWebhookUrl', e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                    </div>
                );
            case 'enableX':
                return (
                    <div className="space-y-2 border-t border-slate-100 py-3">
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API Key</label>
                            <input type="password" value={form.xApiKey || ''} onChange={(e) => updateForm('xApiKey', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">API Secret</label>
                            <input type="password" value={form.xApiSecret || ''} onChange={(e) => updateForm('xApiSecret', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access Token</label>
                            <input type="password" value={form.xAccessToken || ''} onChange={(e) => updateForm('xAccessToken', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access Secret</label>
                            <input type="password" value={form.xAccessSecret || ''} onChange={(e) => updateForm('xAccessSecret', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                    </div>
                );
            case 'enableBluesky':
                return (
                    <div className="space-y-2 border-t border-slate-100 py-3">
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Identifier (Handle)</label>
                            <input type="text" value={form.blueskyIdentifier || ''} onChange={(e) => updateForm('blueskyIdentifier', e.target.value)} placeholder="name.bsky.social" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">App Password</label>
                            <input type="password" value={form.blueskyAppPassword || ''} onChange={(e) => updateForm('blueskyAppPassword', e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                    </div>
                );
            case 'enableMastodon':
                return (
                    <div className="space-y-2 border-t border-slate-100 py-3">
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Instance URL</label>
                            <input type="text" value={form.mastodonInstanceUrl || ''} onChange={(e) => updateForm('mastodonInstanceUrl', e.target.value)} placeholder="https://mastodon.social" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Access Token</label>
                            <input type="password" value={form.mastodonAccessToken || ''} onChange={(e) => updateForm('mastodonAccessToken', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                    </div>
                );
            case 'enablePayloadCMS':
                return (
                    <div className="space-y-2 border-t border-slate-100 py-3">
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Server URL</label>
                            <input type="text" value={form.payloadServerUrl || ''} onChange={(e) => updateForm('payloadServerUrl', e.target.value)} placeholder="http://localhost:3000" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bot Email</label>
                            <input type="text" value={form.payloadBotEmail || ''} onChange={(e) => updateForm('payloadBotEmail', e.target.value)} placeholder="bot@lassez.fr" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                        <div className="grid grid-cols-[150px_1fr] items-center gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bot Password</label>
                            <input type="password" value={form.payloadBotPassword || ''} onChange={(e) => updateForm('payloadBotPassword', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-3 py-1.5 text-[11px] focus:bg-white focus:border-black outline-none transition-all shadow-inner" />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div>
                    <h3 className="text-sm font-semibold text-black">Réseaux Sociaux & Webhooks</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Configuration des clés API et de la politique de publication.</p>
                </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                <div className="flex bg-slate-50 border-b border-slate-200 py-2 px-4">
                    <div className="flex-[2] text-[10px] font-bold text-slate-500 uppercase tracking-widest">Réseau / Service</div>
                    <div className="flex-[1] text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Stratégie</div>
                    <div className="flex-[1] text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Statut</div>
                </div>

                <div className="divide-y divide-slate-100">
                    {PLATFORMS.map((p) => (
                        <div key={p.id} className="group transition-all hover:bg-slate-50/50">
                            <div className="flex items-center px-4 py-3">
                                <div className="flex-[2] font-semibold text-[13px] text-slate-900 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-slate-400">{p.id.includes('Discord') ? 'forum' : p.id.includes('X') ? 'flutter_dash' : p.id.includes('Mastodon') ? 'campaign' : p.id.includes('Bluesky') ? 'public' : 'dns'}</span>
                                    {p.label}
                                </div>
                                <div className="flex-[1] flex justify-center">
                                    {p.mode && form[p.id] ? (
                                        <div className="flex gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                                            {['DIRECT', 'SCHEDULED'].map(m => (
                                                <button 
                                                    key={m}
                                                    onClick={() => updateForm(p.mode, m)}
                                                    className={`px-3 py-1 text-[9px] font-bold rounded-md transition-all shadow-sm ${
                                                        form[p.mode] === m 
                                                            ? 'bg-white text-slate-900 border border-slate-200/60' 
                                                            : 'bg-transparent text-slate-400 hover:text-slate-600'
                                                    }`}
                                                >
                                                    {m === 'DIRECT' ? 'Temps Réel' : 'Planifié'}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-300 italic">—</span>
                                    )}
                                </div>
                                <div className="flex-[1] flex justify-end">
                                    <button 
                                        onClick={() => updateForm(p.id, !form[p.id])}
                                        className={`w-9 h-5 rounded-full relative transition-all shadow-inner border ${form[p.id] ? 'bg-emerald-500 border-emerald-600' : 'bg-slate-200 border-slate-300 hover:bg-slate-300'}`}
                                    >
                                        <div className={`absolute top-[1px] w-4 h-4 rounded-full bg-white transition-all shadow-md ${form[p.id] ? 'left-4' : 'left-[1px]'}`} />
                                    </button>
                                </div>
                            </div>

                            {form[p.id] && (
                                <div className="px-4 pb-4 bg-slate-50/30">
                                    {renderApiFields(p.id)}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
