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
        { id: 'enableMastodon', mode: null, label: 'Mastodon' }, // pas de mode pour mastodon/payloadCMS dans prisma
        { id: 'enablePayloadCMS', mode: null, label: 'Payload CMS' },
    ];

export function DiffusionSection({ form, updateForm }: DiffusionSectionProps) {
    const renderApiFields = (platformId: string) => {
        if (!form[platformId]) return null;

        switch (platformId) {
            case 'enableDiscord':
                return (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Webhook URL</label>
                        <input type="password" value={form.discordWebhookUrl || ''} onChange={(e) => updateForm('discordWebhookUrl', e.target.value)} placeholder="https://discord.com/api/webhooks/..." className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                    </div>
                );
            case 'enableX':
                return (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">API Key</label>
                        <input type="password" value={form.xApiKey || ''} onChange={(e) => updateForm('xApiKey', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                        <label className="text-[9px] font-bold text-slate-400 uppercase">API Secret</label>
                        <input type="password" value={form.xApiSecret || ''} onChange={(e) => updateForm('xApiSecret', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Access Token</label>
                        <input type="password" value={form.xAccessToken || ''} onChange={(e) => updateForm('xAccessToken', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Access Secret</label>
                        <input type="password" value={form.xAccessSecret || ''} onChange={(e) => updateForm('xAccessSecret', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                    </div>
                );
            case 'enableBluesky':
                return (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Identifier (Handle)</label>
                        <input type="text" value={form.blueskyIdentifier || ''} onChange={(e) => updateForm('blueskyIdentifier', e.target.value)} placeholder="name.bsky.social" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                        <label className="text-[9px] font-bold text-slate-400 uppercase">App Password</label>
                        <input type="password" value={form.blueskyAppPassword || ''} onChange={(e) => updateForm('blueskyAppPassword', e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                    </div>
                );
            case 'enableMastodon':
                return (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Instance URL</label>
                        <input type="text" value={form.mastodonInstanceUrl || ''} onChange={(e) => updateForm('mastodonInstanceUrl', e.target.value)} placeholder="https://mastodon.social" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Access Token</label>
                        <input type="password" value={form.mastodonAccessToken || ''} onChange={(e) => updateForm('mastodonAccessToken', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                    </div>
                );
            case 'enablePayloadCMS':
                return (
                    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Server URL</label>
                        <input type="text" value={form.payloadServerUrl || ''} onChange={(e) => updateForm('payloadServerUrl', e.target.value)} placeholder="http://localhost:3000" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Bot Email</label>
                        <input type="text" value={form.payloadBotEmail || ''} onChange={(e) => updateForm('payloadBotEmail', e.target.value)} placeholder="bot@lassez.fr" className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                        <label className="text-[9px] font-bold text-slate-400 uppercase">Bot Password</label>
                        <input type="password" value={form.payloadBotPassword || ''} onChange={(e) => updateForm('payloadBotPassword', e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-sm px-2 py-1.5 text-[10px] focus:bg-white focus:border-black outline-none" />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h3 className="text-sm font-semibold text-black">Réseaux Sociaux & Diffusion</h3>
                <span className="text-[10px] text-slate-400 font-mono italic">Configuration API et Routage</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLATFORMS.map((p) => (
                    <div 
                        key={p.id}
                        className={`p-4 rounded-xl border transition-all ${
                            form[p.id] ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50/50 border-slate-100'
                        }`}
                    >
                        <div className="flex justify-between items-center mb-2">
                            <span className={`text-[12px] font-bold ${form[p.id] ? 'text-black' : 'text-slate-400'}`}>{p.label}</span>
                            <button 
                                onClick={() => updateForm(p.id, !form[p.id])}
                                className={`w-8 h-4.5 rounded-full relative transition-all shadow-inner ${form[p.id] ? 'bg-emerald-500' : 'bg-slate-200'}`}
                            >
                                <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm ${form[p.id] ? 'left-4' : 'left-0.5'}`} />
                            </button>
                        </div>

                        {form[p.id] && p.mode && (
                            <div className="flex gap-1 pt-3 mt-2 border-t border-slate-100">
                                {['DIRECT', 'SCHEDULED'].map(m => (
                                    <button 
                                        key={m}
                                        onClick={() => updateForm(p.mode, m)}
                                        className={`flex-1 py-1.5 text-[9px] font-bold rounded-md border transition-all ${
                                            form[p.mode] === m 
                                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                                                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {m === 'DIRECT' ? 'Temps Réel' : 'Planifié'}
                                    </button>
                                ))}
                            </div>
                        )}

                        {renderApiFields(p.id)}
                    </div>
                ))}
            </div>
        </div>
    );
}
