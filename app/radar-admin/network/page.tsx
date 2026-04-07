'use client';

import React, { useState, useEffect } from 'react';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { DashboardLayout } from '../components/DashboardLayout';

export default function NetworkPage() {
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();
    const [rssFeeds, setRssFeeds] = useState('');
    const [telegramChannels, setTelegramChannels] = useState('');
    const [xAccounts, setXAccounts] = useState('');
    const [rssBridgeBaseUrl, setRssBridgeBaseUrl] = useState('http://localhost:3300');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (settings?.rss_feeds) {
            try { setRssFeeds(JSON.parse(settings.rss_feeds).join('\n')); } catch(e){}
        }
        if (settings?.telegram_channels) {
            try { setTelegramChannels(JSON.parse(settings.telegram_channels).join('\n')); } catch(e){}
        }
        if (settings?.x_accounts) {
            try { setXAccounts(JSON.parse(settings.x_accounts).join('\n')); } catch(e){}
        }
        if (settings?.rss_bridge_base_url) {
            setRssBridgeBaseUrl(settings.rss_bridge_base_url);
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rss_feeds: rssFeeds.split('\n').map(l=>l.trim()).filter(Boolean),
                    telegram_channels: telegramChannels.split('\n').map(l=>l.trim().replace('@', '')).filter(Boolean),
                    x_accounts: xAccounts.split('\n').map(l => l.trim().replace('@', '')).filter(Boolean),
                    rss_bridge_base_url: rssBridgeBaseUrl.trim() || 'http://localhost:3300',
                })
            });
            fetchSettings();
        } catch (e) { console.error(e); }
        finally { setIsSaving(false); }
    };

    return (
        <DashboardLayout 
            title="SOURCES RÉSEAU" 
            subtitle={countdown || "Synchronisation des signaux OSINT..."} 
            isDaemonRunning={isDaemonRunning}
        >
            <div className="max-w-4xl space-y-12 font-label">
                <header>
                    <h2 className="text-3xl font-black uppercase tracking-tighter font-headline mb-2">Nœuds réseau</h2>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Gestion des sources RSS, Telegram et X via RSS Bridge</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* RSS Feeds */}
                    <section className="bg-white border-4 border-stone-900 shadow-[8px_8px_0px_0px_#1A1C1C] p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="material-symbols-outlined text-red-700 text-3xl">rss_feed</span>
                            <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Cibles RSS</h3>
                        </div>
                        <textarea 
                            value={rssFeeds} 
                            onChange={e => setRssFeeds(e.target.value)}
                            rows={12}
                            placeholder="Une URL par ligne..."
                            className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-[11px] leading-relaxed focus:bg-white focus:outline-none transition-all"
                        />
                        <p className="mt-4 text-[9px] font-bold text-stone-400 uppercase leading-relaxed">
                            Le daemon scanne ces flux en continu pour extraire des signaux à analyser.
                        </p>
                    </section>

                    {/* Telegram Channels */}
                    <section className="bg-white border-4 border-stone-900 shadow-[8px_8px_0px_0px_#1A1C1C] p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="material-symbols-outlined text-sky-500 text-3xl">send</span>
                            <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Canaux Telegram</h3>
                        </div>
                        <textarea 
                            value={telegramChannels} 
                            onChange={e => setTelegramChannels(e.target.value)}
                            rows={12}
                            placeholder="@identifiant_canal par ligne..."
                            className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-[11px] leading-relaxed focus:bg-white focus:outline-none transition-all"
                        />
                        <p className="mt-4 text-[9px] font-bold text-stone-400 uppercase leading-relaxed">
                            Exemple: bfmtv_fr, cnews_fr, FranceInsoumise.
                        </p>
                    </section>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="bg-white border-4 border-stone-900 shadow-[8px_8px_0px_0px_#1A1C1C] p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="material-symbols-outlined text-stone-900 text-3xl">alternate_email</span>
                            <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Comptes X (via RSS Bridge)</h3>
                        </div>
                        <textarea
                            value={xAccounts}
                            onChange={e => setXAccounts(e.target.value)}
                            rows={10}
                            placeholder="@JLMelenchon&#10;@MathildePanot&#10;@RimaHas&#10;@Manuel_Bompard"
                            className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-[11px] leading-relaxed focus:bg-white focus:outline-none transition-all"
                        />
                        <p className="mt-4 text-[9px] font-bold text-stone-400 uppercase leading-relaxed">
                            Les flux RSS TwitterBridge sont générés automatiquement depuis cette liste.
                        </p>
                    </section>
                    <section className="bg-white border-4 border-stone-900 shadow-[8px_8px_0px_0px_#1A1C1C] p-8">
                        <div className="flex items-center gap-4 mb-6">
                            <span className="material-symbols-outlined text-red-700 text-3xl">dns</span>
                            <h3 className="text-xl font-black uppercase tracking-tighter font-headline">URL RSS Bridge</h3>
                        </div>
                        <input
                            type="text"
                            value={rssBridgeBaseUrl}
                            onChange={e => setRssBridgeBaseUrl(e.target.value)}
                            placeholder="http://localhost:3300"
                            className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-[11px] leading-relaxed focus:bg-white focus:outline-none transition-all"
                        />
                        <p className="mt-4 text-[9px] font-bold text-stone-400 uppercase leading-relaxed">
                            Exemple VPS: http://127.0.0.1:3300 ou ton domaine interne.
                        </p>
                    </section>
                </div>

                <footer className="flex justify-end pt-8">
                    <button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-red-700 text-white px-12 py-4 border-4 border-stone-900 font-black uppercase tracking-[0.2em] shadow-[8px_8px_0px_0px_rgba(26,28,28,0.3)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all active:shadow-none active:translate-x-0 active:translate-y-0"
                    >
                        {isSaving ? 'MISE À JOUR...' : 'ENREGISTRER LE RÉSEAU'}
                    </button>
                </footer>
            </div>
        </DashboardLayout>
    );
}
