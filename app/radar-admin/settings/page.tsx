'use client';

import React, { useState, useEffect } from 'react';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { DashboardLayout } from '../components/DashboardLayout';

export default function SettingsPage() {
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'prompt' | 'pipeline' | 'diffusion' | 'health' | 'comms'>('prompt');
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState<any>({});

    useEffect(() => {
        if (settings) setForm({ ...settings });
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            fetchSettings();
        } catch (e) { console.error(e); }
        finally { setIsSaving(false); }
    };

    const updateForm = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }));

    const tabs = [
        { key: 'prompt', label: 'Moteur IA', icon: 'psychology' },
        { key: 'pipeline', label: 'Pipeline', icon: 'tune' },
        { key: 'diffusion', label: 'Diffusion', icon: 'share' },
        { key: 'health', label: 'Maintenance', icon: 'health_and_safety' },
        { key: 'comms', label: 'Comms', icon: 'campaign' },
    ];

    return (
        <DashboardLayout 
            title="CORTEX SETTINGS" 
            subtitle={countdown || "Configuration système active..."} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="max-w-6xl font-label">
                <header className="mb-12">
                    <h2 className="text-3xl font-black uppercase tracking-tighter font-headline mb-2">Paramètres Cortex</h2>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Configuration globale des moteurs OSINT et diffusion</p>
                </header>

                <div className="flex flex-col md:flex-row gap-12">
                    {/* Internal Nav */}
                    <nav className="w-full md:w-64 flex flex-col gap-4">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex items-center gap-3 px-6 py-4 border-4 transition-all text-sm font-black uppercase tracking-tight ${
                                    activeTab === tab.key 
                                        ? 'bg-stone-900 text-white border-stone-900 shadow-[4px_4px_0px_0px_#bc0100]' 
                                        : 'bg-white text-stone-500 border-stone-100 hover:border-stone-900 hover:text-stone-900'
                                }`}
                            >
                                <span className="material-symbols-outlined">{tab.icon}</span>
                                {tab.label}
                            </button>
                        ))}
                        
                        <button 
                            onClick={handleSave}
                            disabled={isSaving}
                            className="mt-8 bg-red-700 text-white py-4 border-4 border-stone-900 font-black uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(26,28,28,0.2)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                        >
                            {isSaving ? 'ENREGISTREMENT...' : 'ENREGISTRER'}
                        </button>
                    </nav>

                    {/* Settings Panel */}
                    <div className="flex-1 bg-white border-4 border-stone-900 shadow-[12px_12px_0px_0px_#1A1C1C] p-10 min-h-[600px]">
                        {activeTab === 'prompt' && (
                            <div className="space-y-6">
                                <h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-4">Prompt maître IA</h3>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Main Gemini Model</label>
                                    <input
                                        type="text"
                                        value={form.ai_model_main || 'gemini-2.5-pro-preview-05-06'}
                                        onChange={e => updateForm('ai_model_main', e.target.value)}
                                        className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs"
                                    />
                                </div>
                                <textarea 
                                    value={form.ai_prompt || ''} 
                                    onChange={e => updateForm('ai_prompt', e.target.value)}
                                    rows={20}
                                    className="w-full bg-stone-50 border-4 border-stone-900 p-6 font-body text-sm leading-relaxed focus:bg-white focus:outline-none transition-all"
                                />
                                <p className="text-[10px] font-bold text-stone-400 uppercase">Ce prompt définit le ton éditorial, le filtrage et la précision d'extraction du Cortex.</p>
                            </div>
                        )}

                        {activeTab === 'pipeline' && (
                            <div className="space-y-8">
                                <section className="space-y-4">
                                    <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Dedup Engine</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Similarity Threshold</label>
                                            <input type="number" step="0.01" min="0.3" max="0.95" value={form.dedup_similarity_threshold || '0.65'} onChange={e => updateForm('dedup_similarity_threshold', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Recent Window (hours)</label>
                                            <input type="number" min="1" max="168" value={form.dedup_recent_hours || '24'} onChange={e => updateForm('dedup_recent_hours', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Video OSINT</h3>
                                        <Toggle checked={form.video_ingest_enabled !== 'false'} onChange={v => updateForm('video_ingest_enabled', v ? 'true' : 'false')} />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Pre-filter Model</label>
                                            <input type="text" value={form.video_prefilter_model || 'gemini-2.0-flash'} onChange={e => updateForm('video_prefilter_model', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Transcribe Model</label>
                                            <input type="text" value={form.video_transcribe_model || 'gemini-2.0-flash'} onChange={e => updateForm('video_transcribe_model', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Min chars for pre-filter</label>
                                            <input type="number" min="1" value={form.video_prefilter_min_chars || '20'} onChange={e => updateForm('video_prefilter_min_chars', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Max audio size (MB)</label>
                                            <input type="number" min="1" value={form.video_max_audio_mb || '20'} onChange={e => updateForm('video_max_audio_mb', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Pre-filter Prompt (use {"{{MESSAGE}}"})</label>
                                        <textarea value={form.video_prefilter_prompt || ''} onChange={e => updateForm('video_prefilter_prompt', e.target.value)} rows={5} className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-body text-xs" />
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Source Trust Map (JSON)</h3>
                                    <textarea
                                        value={form.source_trust_map || ''}
                                        onChange={e => updateForm('source_trust_map', e.target.value)}
                                        rows={8}
                                        className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-[11px] leading-relaxed"
                                    />
                                </section>
                            </div>
                        )}

                        {activeTab === 'diffusion' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <section className="space-y-6">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6">Target Networks</h4>
                                    {[
                                        { key: 'social_mastodon_enabled', label: 'Mastodon' },
                                        { key: 'social_bluesky_enabled', label: 'Bluesky' },
                                        { key: 'social_twitter_enabled', label: 'Twitter / X' },
                                        { key: 'social_discord_enabled', label: 'Discord Webhook' },
                                    ].map(n => (
                                        <div key={n.key} className="flex items-center justify-between p-4 bg-stone-50 border-2 border-stone-100">
                                            <span className="font-bold uppercase text-xs">{n.label}</span>
                                            <Toggle 
                                                checked={form[n.key] === 'true'} 
                                                onChange={v => updateForm(n.key, v ? 'true' : 'false')} 
                                            />
                                        </div>
                                    ))}

                                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mt-10 mb-4">Automation Modes</h4>
                                    {[
                                        { key: 'auto_pilot_enabled', label: 'Auto Publish (APPROVED queue)' },
                                        { key: 'auto_approve_enabled', label: 'Auto Approve (Ghost mode)' },
                                        { key: 'discord_test_mode', label: 'Discord Test Mode' },
                                    ].map(n => (
                                        <div key={n.key} className="flex items-center justify-between p-4 bg-stone-50 border-2 border-stone-100">
                                            <span className="font-bold uppercase text-xs">{n.label}</span>
                                            <Toggle
                                                checked={form[n.key] === 'true'}
                                                onChange={v => updateForm(n.key, v ? 'true' : 'false')}
                                            />
                                        </div>
                                    ))}
                                </section>

                                <section className="space-y-6">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6">Timing & Frequency</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Max Signals per Scan</label>
                                            <input 
                                                type="number" 
                                                value={form.max_articles || 3} 
                                                onChange={e => updateForm('max_articles', e.target.value)}
                                                className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Min Delay (m)</label>
                                                <input type="number" value={form.min_delay_min || 0} onChange={e => updateForm('min_delay_min', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Max Delay (m)</label>
                                                <input type="number" value={form.max_delay_min || 15} onChange={e => updateForm('max_delay_min', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">RSS Lookback (h)</label>
                                                <input type="number" min="1" value={form.rss_lookback_hours || 24} onChange={e => updateForm('rss_lookback_hours', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Scan Interval (h)</label>
                                                <input type="number" step="0.1" min="0.1" value={form.scan_interval_hours || 2} onChange={e => updateForm('scan_interval_hours', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Elections Interval (h)</label>
                                                <input type="number" step="0.1" min="0.1" value={form.election_interval_hours || 0.5} onChange={e => updateForm('election_interval_hours', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                            </div>
                                            <div className="flex flex-col justify-end gap-3">
                                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-100">
                                                    <span className="font-bold uppercase text-[10px]">Daemon RSS</span>
                                                    <Toggle checked={form.daemon_rss_enabled !== 'false'} onChange={v => updateForm('daemon_rss_enabled', v ? 'true' : 'false')} />
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-100">
                                                    <span className="font-bold uppercase text-[10px]">Daemon Elections</span>
                                                    <Toggle checked={form.daemon_elections_enabled === 'true'} onChange={v => updateForm('daemon_elections_enabled', v ? 'true' : 'false')} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'health' && (
                            <div className="space-y-8">
                                <h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-4">Maintenance Mode</h3>
                                <div className="p-6 bg-stone-50 border-4 border-stone-900 flex items-center justify-between">
                                    <div>
                                        <span className="font-black uppercase text-sm block">System Lock</span>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase">Prevents all public access to the news feed</p>
                                    </div>
                                    <Toggle 
                                        checked={form.maintenance_mode === 'true'} 
                                        onChange={v => updateForm('maintenance_mode', v ? 'true' : 'false')} 
                                    />
                                </div>
                                <textarea 
                                    value={form.maintenance_message || ''} 
                                    onChange={e => updateForm('maintenance_message', e.target.value)}
                                    placeholder="Maintenance message..."
                                    rows={4}
                                    className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-bold text-xs"
                                />
                            </div>
                        )}

                        {activeTab === 'comms' && (
                            <div className="space-y-8">
                                <div className="flex items-center justify-between border-b-4 border-stone-100 pb-6">
                                    <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Global Alert Popup</h3>
                                    <Toggle checked={form.popup_enabled === 'true'} onChange={v => updateForm('popup_enabled', v ? 'true' : 'false')} />
                                </div>
                                <div className="grid grid-cols-1 gap-6">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Alert Title</label>
                                        <input type="text" value={form.popup_title || ''} onChange={e => updateForm('popup_title', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Body Message</label>
                                        <textarea value={form.popup_text || ''} onChange={e => updateForm('popup_text', e.target.value)} rows={3} className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-bold text-xs" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Link Label</label>
                                            <input type="text" value={form.popup_link_label || ''} onChange={e => updateForm('popup_link_label', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Target URL</label>
                                            <input type="text" value={form.popup_link_url || ''} onChange={e => updateForm('popup_link_url', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function Toggle({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`w-12 h-6 border-2 border-stone-900 transition-colors relative ${checked ? 'bg-red-700' : 'bg-stone-200'}`}
        >
            <div className={`absolute top-0 w-4 h-4 border-2 border-stone-900 bg-white transition-all ${checked ? 'left-6' : 'left-0'}`} />
        </button>
    );
}
