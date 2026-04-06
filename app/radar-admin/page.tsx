'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { TooltipInfo, Toggle, SettingRow, StatusBadge } from './components/UIComponents';
import { ConsoleTab } from './components/ConsoleTab';
import { StudioSocialTab } from './components/StudioSocialTab';
import { TestIATab } from './components/TestIATab';
import { RadarCard, RadarPost } from './components/RadarCard';

export default function RadarAdminPage() {
    const [posts, setPosts] = useState<RadarPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'IGNORED' | 'CONSOLE' | 'STUDIO' | 'TEST_IA'>('PENDING');
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [geoFilter, setGeoFilter] = useState<'all' | 'france' | 'international'>('all');
    const [activeTag, setActiveTag] = useState<string | null>(null);
    const [trendingTags, setTrendingTags] = useState<{ tag: string; count: number }[]>([]);

    const [isAutoPilot, setIsAutoPilot] = useState(false);
    const [isTogglingPilot, setIsTogglingPilot] = useState(false);
    const [isAutoApprove, setIsAutoApprove] = useState(false);
    const [isTogglingApprove, setIsTogglingApprove] = useState(false);

    const [maxArticles, setMaxArticles] = useState(3);
    const [minDelay, setMinDelay] = useState(0);
    const [maxDelay, setMaxDelay] = useState(15);
    const [rssLookbackHours, setRssLookbackHours] = useState(24);
    const [scanIntervalMin, setScanIntervalMin] = useState(120);
    const [isTriggering, setIsTriggering] = useState(false);
    const [triggerLogs, setTriggerLogs] = useState<string | null>(null);
    const [nextScanAt, setNextScanAt] = useState<Date | null>(null);
    const [countdown, setCountdown] = useState<string | null>(null);

    const [electionIntervalHours, setElectionIntervalHours] = useState(0.5);
    const [daemonRssEnabled, setDaemonRssEnabled] = useState(true);
    const [daemonElectionsEnabled, setDaemonElectionsEnabled] = useState(false);
    const [socialMastodonEnabled, setSocialMastodonEnabled] = useState(true);
    const [socialBlueskyEnabled, setSocialBlueskyEnabled] = useState(true);
    const [socialTwitterEnabled, setSocialTwitterEnabled] = useState(true);
    const [socialDiscordEnabled, setSocialDiscordEnabled] = useState(false);
    const [discordTestMode, setDiscordTestMode] = useState(false);
    const [rssFeeds, setRssFeeds] = useState('');
    const [telegramChannels, setTelegramChannels] = useState('');
    const [aiPrompt, setAiPrompt] = useState('');
    const [settingsTab, setSettingsTab] = useState<'sources' | 'moteur' | 'sociaux' | 'sante' | 'comm'>('sources');
    const [lastScanErrors, setLastScanErrors] = useState<{source: string, type: string, error: string}[]>([]);

    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [popupEnabled, setPopupEnabled] = useState(false);
    const [popupTitle, setPopupTitle] = useState('');
    const [popupText, setPopupText] = useState('');
    const [popupLinkUrl, setPopupLinkUrl] = useState('');
    const [popupLinkLabel, setPopupLinkLabel] = useState('');

    const [navItems, setNavItems] = useState<{ slug: string; label: string; path: string; enabled: boolean; badge: string | null }[]>([]);
    const [showNavSection, setShowNavSection] = useState(false);
    const [navSaving, setNavSaving] = useState<string | null>(null);

    const [showElectionsSection, setShowElectionsSection] = useState(false);
    const [electionResults, setElectionResults] = useState<any[]>([]);
    const [electionForm, setElectionForm] = useState({
        election_slug: 'municipales-2026',
        ville: '',
        tour: '1',
        candidat: '',
        nuance: '',
        pct: '',
        voix: '',
        statut: 'qualifie',
    });
    const [electionSaving, setElectionSaving] = useState(false);
    const [electionMsg, setElectionMsg] = useState<string | null>(null);
    const [villesSaisies, setVillesSaisies] = useState<string[]>([]);
    const [isSyncingOfficial, setIsSyncingOfficial] = useState(false);

    const NUANCES = ['LFI', 'NFP', 'NUPES', 'PS', 'EELV', 'PRG', 'DVG', 'REN', 'ENS', 'MoDem', 'HOR', 'DVC', 'LR', 'DVD', 'UDI', 'RN', 'DLF', 'REC', 'EXD', 'PCF', 'NPA', 'SE', 'DIV'];
    const STATUTS = [
        { value: 'qualifie', label: 'Qualifie' },
        { value: 'elu',      label: 'Elu·e' },
        { value: 'elimine',  label: 'Elimine' },
        { value: 'retrait',  label: 'Retrait' },
    ];

    const fetchNavItems = async () => {
        const res = await fetch('/api/radar/nav?all=1');
        const data = await res.json();
        if (data.success) setNavItems(data.navItems);
    };

    const fetchElectionResults = async () => {
        const res = await fetch('/api/elections/results?slug=municipales-2026&all=1');
        const data = await res.json();
        if (data.success) {
            const flat: any[] = [];
            for (const vr of data.results) {
                for (const tour of vr.tours) {
                    if (tour.hasData) {
                        for (const c of tour.candidats) {
                            flat.push({ ...c, ville: vr.ville, tour: tour.tour });
                        }
                    }
                }
            }
            setElectionResults(flat.sort((a, b) => a.ville.localeCompare(b.ville) || a.tour - b.tour || b.pct - a.pct));
            setVillesSaisies([...new Set(data.results.map((r: any) => r.ville))] as string[]);
        }
    };

    const submitElectionResult = async () => {
        if (!electionForm.ville || !electionForm.candidat || !electionForm.pct) return;
        setElectionSaving(true);
        setElectionMsg(null);
        const res = await fetch('/api/elections/results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                election_slug: electionForm.election_slug,
                ville: electionForm.ville,
                tour: parseInt(electionForm.tour),
                candidat: electionForm.candidat,
                nuance: electionForm.nuance || null,
                pct: parseFloat(electionForm.pct),
                voix: parseInt(electionForm.voix) || 0,
                statut: electionForm.statut,
            }),
        });
        const json = await res.json();
        setElectionMsg(json.message || json.error || null);
        setElectionForm(f => ({ ...f, candidat: '', nuance: '', pct: '', voix: '', statut: 'qualifie' }));
        await fetchElectionResults();
        setElectionSaving(false);
    };

    const deleteElectionResult = async (id: number) => {
        await fetch(`/api/elections/results?id=${id}`, { method: 'DELETE' });
        setElectionResults(prev => prev.filter(o => o.id !== id));
    };

    const handleSyncOfficial = async () => {
        if (!confirm('Voulez-vous forcer la synchronisation avec data.gouv.fr ? Cela peut prendre 30-60 secondes.')) return;
        setIsSyncingOfficial(true);
        setElectionMsg('Synchronisation en cours...');
        try {
            const res = await fetch('/api/elections/results?slug=municipales-2026&forceSync=1');
            const data = await res.json();
            if (data.success) {
                setElectionMsg('Synchronisation terminée avec succès !');
                await fetchElectionResults();
            } else {
                setElectionMsg('Erreur lors de la synchronisation : ' + (data.error || 'Erreur inconnue'));
            }
        } catch (e: any) {
            setElectionMsg('Erreur réseau : ' + e.message);
        } finally {
            setIsSyncingOfficial(false);
        }
    };

    const toggleNavItem = async (slug: string, enabled: boolean) => {
        setNavSaving(slug);
        try {
            const res = await fetch('/api/radar/nav', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, enabled }),
            });
            const data = await res.json();
            if (data.success) {
                setNavItems(prev => prev.map(item => item.slug === slug ? { ...item, enabled } : item));
                sessionStorage.removeItem('lassez_nav');
                sessionStorage.removeItem('lassez_nav_at');
            } else {
                alert(`Erreur: ${data.error || 'Impossible de mettre à jour la rubrique.'}`);
            }
        } catch (e: any) {
            alert('Erreur réseau : impossible de contacter le serveur.');
        } finally {
            setNavSaving(null);
        }
    };

    useEffect(() => { if (showNavSection) fetchNavItems(); }, [showNavSection]);
    useEffect(() => { if (showElectionsSection) fetchElectionResults(); }, [showElectionsSection]);
    useEffect(() => { fetchQueue(); }, [activeTab, geoFilter, activeTag]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/radar/settings');
                const data = await res.json();
                if (data.settings?.max_articles) setMaxArticles(parseInt(data.settings.max_articles));
                if (data.settings?.min_delay_min) setMinDelay(parseInt(data.settings.min_delay_min));
                if (data.settings?.max_delay_min) setMaxDelay(parseInt(data.settings.max_delay_min));
                if (data.settings?.rss_lookback_hours) setRssLookbackHours(parseInt(data.settings.rss_lookback_hours));
                if (data.settings?.scan_interval_hours) setScanIntervalMin(Math.round(parseFloat(data.settings.scan_interval_hours) * 60));
                if (data.settings?.auto_pilot_enabled) setIsAutoPilot(data.settings.auto_pilot_enabled === 'true');
                if (data.settings?.auto_approve_enabled) setIsAutoApprove(data.settings.auto_approve_enabled === 'true');
                if (data.settings?.next_scan_at) setNextScanAt(new Date(data.settings.next_scan_at));
                if (data.settings?.election_interval_hours) setElectionIntervalHours(parseFloat(data.settings.election_interval_hours));
                if (data.settings?.daemon_rss_enabled) setDaemonRssEnabled(data.settings.daemon_rss_enabled === 'true');
                if (data.settings?.daemon_elections_enabled) setDaemonElectionsEnabled(data.settings.daemon_elections_enabled === 'true');
                if (data.settings?.social_mastodon_enabled) setSocialMastodonEnabled(data.settings.social_mastodon_enabled === 'true');
                if (data.settings?.social_bluesky_enabled) setSocialBlueskyEnabled(data.settings.social_bluesky_enabled === 'true');
                if (data.settings?.social_twitter_enabled) setSocialTwitterEnabled(data.settings.social_twitter_enabled === 'true');
                if (data.settings?.social_discord_enabled) setSocialDiscordEnabled(data.settings.social_discord_enabled === 'true');
                if (data.settings?.discord_test_mode) setDiscordTestMode(data.settings.discord_test_mode === 'true');
                if (data.settings?.rss_feeds) try { setRssFeeds(JSON.parse(data.settings.rss_feeds).join('\n')); } catch(e){}
                if (data.settings?.telegram_channels) try { setTelegramChannels(JSON.parse(data.settings.telegram_channels).join('\n')); } catch(e){}
                if (data.settings?.ai_prompt) setAiPrompt(data.settings.ai_prompt);
                if (data.settings?.last_scan_errors) { try { setLastScanErrors(JSON.parse(data.settings.last_scan_errors)); } catch(e){} }
                if (data.settings?.maintenance_mode) setMaintenanceMode(data.settings.maintenance_mode === 'true');
                if (data.settings?.maintenance_message) setMaintenanceMessage(data.settings.maintenance_message);
                if (data.settings?.popup_enabled) setPopupEnabled(data.settings.popup_enabled === 'true');
                if (data.settings?.popup_title) setPopupTitle(data.settings.popup_title);
                if (data.settings?.popup_text) setPopupText(data.settings.popup_text);
                if (data.settings?.popup_link_url) setPopupLinkUrl(data.settings.popup_link_url);
                if (data.settings?.popup_link_label) setPopupLinkLabel(data.settings.popup_link_label);
            } catch (e) { }
        };
        fetchSettings();
        const intervalSettings = setInterval(fetchSettings, 20000);
        return () => clearInterval(intervalSettings);
    }, []);

    useEffect(() => {
        const tick = () => {
            if (!nextScanAt) { setCountdown(null); return; }
            const diffMs = nextScanAt.getTime() - Date.now();
            if (diffMs <= 0 && diffMs > -(5 * 60 * 1000)) { setCountdown('Scanner en cours… ⚙️'); return; }
            if (diffMs <= - (5 * 60 * 1000)) { setCountdown('Daemon IDLE'); return; }
            const h = Math.floor(diffMs / 3600000);
            const m = Math.floor((diffMs % 3600000) / 60000);
            const s = Math.floor((diffMs % 60000) / 1000);
            setCountdown(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [nextScanAt]);

    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsSavedFeedback, setSettingsSavedFeedback] = useState(false);

    const saveSettings = async () => {
        setIsSavingSettings(true);
        try {
            await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rss_feeds: rssFeeds.split('\n').map(l=>l.trim()).filter(Boolean),
                    telegram_channels: telegramChannels.split('\n').map(l=>l.trim().replace('@', '')).filter(Boolean),
                    ai_prompt: aiPrompt,
                    auto_pilot_enabled: isAutoPilot,
                    auto_approve_enabled: isAutoApprove,
                    max_articles: maxArticles,
                    rss_lookback_hours: rssLookbackHours,
                    scan_interval_hours: scanIntervalMin / 60,
                    min_delay_min: minDelay,
                    max_delay_min: maxDelay,
                    daemon_rss_enabled: daemonRssEnabled,
                    daemon_elections_enabled: daemonElectionsEnabled,
                    election_interval_hours: electionIntervalHours,
                    social_mastodon_enabled: socialMastodonEnabled,
                    social_bluesky_enabled: socialBlueskyEnabled,
                    social_twitter_enabled: socialTwitterEnabled,
                    social_discord_enabled: socialDiscordEnabled,
                    discord_test_mode: discordTestMode,
                    maintenance_mode: maintenanceMode,
                    maintenance_message: maintenanceMessage,
                    popup_enabled: popupEnabled,
                    popup_title: popupTitle,
                    popup_text: popupText,
                    popup_link_url: popupLinkUrl,
                    popup_link_label: popupLinkLabel
                })
            });
            setSettingsSavedFeedback(true);
            setTimeout(() => setSettingsSavedFeedback(false), 3000);
        } catch (e) {
            alert("Erreur lors de la sauvegarde.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    const triggerGeneration = async () => {
        if (!confirm("Lancer manuellement l'IA ?")) return;
        setIsTriggering(true);
        setTriggerLogs("Connexion Radar...");
        try {
            const res = await fetch('/api/radar/trigger', { method: 'POST' });
            if (!res.body) throw new Error("Streaming impossible");
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                setTriggerLogs(prev => (prev || "") + decoder.decode(value, { stream: true }));
            }
            fetchQueue();
        } catch (e: any) { setTriggerLogs(prev => (prev || "") + "\n❌ Erreur : " + e.message); }
        setIsTriggering(false);
    };

    const fetchQueue = async () => {
        setSelectedIds([]);
        if (['CONSOLE', 'STUDIO', 'TEST_IA'].includes(activeTab)) { setLoading(false); return; }
        setLoading(true);
        try {
            const params = new URLSearchParams({ status: activeTab });
            if (geoFilter && geoFilter !== 'all') params.set('geo', geoFilter);
            if (activeTag) params.set('tag', activeTag);
            const res = await fetch(`/api/radar?${params.toString()}`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success) {
                setPosts(data.posts);
                if (data.trending_tags?.length) setTrendingTags(data.trending_tags);
            } else setError(data.error);
        } catch (err: any) { setError(err.message); }
        finally { setLoading(false); }
    };

    const handleUpdateStatus = async (id: number, status: 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'IGNORED' | 'PENDING', newContent?: string, newImageUrl?: string, newTitle?: string) => {
        try {
            const res = await fetch('/api/radar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status, flash_content: newContent, image_keyword: newImageUrl, source_title: newTitle })
            });
            if (res.ok) setPosts(posts.filter(p => p.id !== id));
            else alert("Erreur lors de la mise à jour");
        } catch { alert("Erreur réseau"); }
    };

    const handleBulkStatus = async (status: 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'IGNORED' | 'PENDING') => {
        if (!confirm(`Appliquer ${status} à ${selectedIds.length} articles ?`)) return;
        try {
            const res = await fetch('/api/radar', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, status })
            });
            if (res.ok) {
                setPosts(posts.filter(p => !selectedIds.includes(p.id)));
                setSelectedIds([]);
            } else alert("Erreur lors de la mise à jour");
        } catch { alert("Erreur réseau"); }
    };

    const TABS = [
        { key: 'PENDING', label: 'À modérer', icon: '⚡' },
        { key: 'APPROVED', label: 'En file', icon: '🕒' },
        { key: 'PUBLISHED', label: 'Publiés', icon: '✅' },
        { key: 'REJECTED', label: 'Rejetés', icon: '🗑️' },
        { key: 'IGNORED', label: 'Annexe', icon: '📦' },
        { key: 'CONSOLE', label: 'Console', icon: '📟' },
        { key: 'STUDIO', label: 'Studio', icon: '📣' },
        { key: 'TEST_IA', label: 'Labo IA', icon: '🧪' },
    ] as const;

    return (
        <div className="min-h-screen bg-stone-50 select-none pb-24" style={{ fontFamily: "var(--font-inter), 'Inter', sans-serif" }}>

            {/* ── HEADER ─────────────────────────────────── */}
            <header className="bg-white/80 backdrop-blur-xl border-b-4 border-stone-900 sticky top-0 z-50 px-8 py-6">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-rose-600 border-4 border-stone-900 rounded-[0.8rem] flex items-center justify-center text-white font-black text-xl shadow-[4px_4px_0px_0px_rgba(28,25,23,1)]">R</div>
                            <div>
                                <h1 className="font-black text-2xl uppercase tracking-tighter italic leading-none">Radar L'Assez</h1>
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">Intelligence OSINT & Social v3.0</p>
                            </div>
                        </div>
                        <div className="h-10 w-1 bg-stone-100 rounded-full hidden md:block" />
                        <StatusBadge isAutoApprove={isAutoApprove} isAutoPilot={isAutoPilot} />
                    </div>

                    <div className="flex items-center gap-6">
                        {countdown && (
                            <div className="flex items-center gap-3 bg-stone-900 text-white px-5 py-2.5 rounded-[1.2rem] shadow-xl">
                                <span className="w-2 h-2 bg-rose-500 rounded-full animate-ping" />
                                <span className="text-xs font-black uppercase tracking-widest leading-none mt-0.5">{countdown}</span>
                            </div>
                        )}
                        <button 
                            onClick={() => setShowSettings(!showSettings)}
                            className={`w-12 h-12 flex items-center justify-center rounded-[1rem] border-4 border-stone-900 transition-all ${showSettings ? 'bg-stone-900 text-white translate-y-1 shadow-none' : 'bg-white text-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:-translate-y-0.5'}`}
                        >
                            <span className="text-xl">⚙️</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto px-8 pt-10">
                
                {/* ── NAVIDATION ────────────────────────────── */}
                <nav className="flex flex-wrap items-center gap-3 mb-12">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-3 px-6 py-4 rounded-[1.5rem] border-4 transition-all uppercase font-black text-xs tracking-widest ${activeTab === tab.key 
                                ? 'bg-stone-900 text-white border-stone-900 shadow-2xl scale-105' 
                                : 'bg-white text-stone-400 border-stone-200 hover:border-stone-400 hover:text-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.05)]'}`}
                        >
                            <span className="text-xl">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <div className="grid grid-cols-1 gap-10">
                    <AnimatePresence mode="wait">
                        {showSettings ? (
                            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} className="bg-white rounded-[3rem] border-[8px] border-stone-900 p-12 shadow-[32px_32px_0px_0px_rgba(28,25,23,1)]">
                                <div className="flex flex-col md:flex-row gap-16">
                                    <div className="w-full md:w-64 space-y-3">
                                        {(['sources', 'moteur', 'sociaux', 'sante', 'comm'] as const).map(s => (
                                            <button 
                                                key={s} 
                                                onClick={() => setSettingsTab(s)}
                                                className={`w-full text-left px-6 py-4 rounded-3xl font-black uppercase tracking-widest text-[10px] transition-all border-4 ${settingsTab === s ? 'bg-stone-900 text-white border-stone-900 shadow-xl translate-x-2' : 'bg-transparent text-stone-400 border-transparent hover:bg-stone-100 hover:text-stone-600'}`}
                                            >
                                                {s === 'sources' ? '📡 Sources Flux' : s === 'moteur' ? '⚙️ Moteur IA' : s === 'sociaux' ? '🔗 Réseaux' : s === 'sante' ? '🏥 Maintenance' : '📢 Communication'}
                                            </button>
                                        ))}
                                        <div className="pt-10">
                                            <button 
                                                onClick={saveSettings} 
                                                disabled={isSavingSettings}
                                                className="w-full bg-rose-600 text-white py-6 rounded-[2rem] border-8 border-stone-900 font-black uppercase tracking-widest text-xs shadow-[12px_12px_0px_0px_rgba(225,29,72,0.2)] hover:shadow-none transition-all active:translate-y-2 disabled:opacity-50"
                                            >
                                                {isSavingSettings ? 'Save...' : 'Sauvegarder'}
                                            </button>
                                            {settingsSavedFeedback && <p className="text-center text-[10px] font-black text-emerald-500 uppercase mt-4">✓ Paramètres synchronisés</p>}
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-8 animate-in fade-in slide-in-from-right-4">
                                        {settingsTab === 'sources' && (
                                            <div className="space-y-8">
                                                <div className="bg-stone-50 rounded-[2.5rem] p-10 border-4 border-stone-100 group">
                                                    <h4 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                                                        <span className="p-2 bg-stone-900 text-white rounded-xl text-sm">RSS</span>
                                                        Flux RSS Automatisés
                                                    </h4>
                                                    <textarea 
                                                        value={rssFeeds} 
                                                        onChange={e => setRssFeeds(e.target.value)}
                                                        rows={8}
                                                        className="w-full bg-white border-4 border-stone-200 rounded-[1.5rem] p-6 font-mono text-xs focus:border-stone-900 focus:outline-none transition-all shadow-inner"
                                                        placeholder="Un lien par ligne..."
                                                    />
                                                </div>
                                                <div className="bg-stone-50 rounded-[2.5rem] p-10 border-4 border-stone-100 group">
                                                    <h4 className="text-xl font-black uppercase tracking-tighter mb-6 flex items-center gap-3">
                                                        <span className="p-2 bg-sky-500 text-white rounded-xl text-sm">TG</span>
                                                        Canaux Telegram OSINT
                                                    </h4>
                                                    <textarea 
                                                        value={telegramChannels} 
                                                        onChange={e => setTelegramChannels(e.target.value)}
                                                        rows={8}
                                                        className="w-full bg-white border-4 border-stone-200 rounded-[1.5rem] p-6 font-mono text-xs focus:border-stone-900 focus:outline-none transition-all shadow-inner"
                                                        placeholder="@channel_id par ligne..."
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {settingsTab === 'moteur' && (
                                            <div className="bg-stone-950 text-stone-400 rounded-[2.5rem] p-10 border-[6px] border-stone-900 shadow-2xl">
                                                <div className="flex items-center gap-4 mb-8">
                                                    <div className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
                                                    <h4 className="text-xl font-black uppercase tracking-tighter text-white">Prompt Système Maître (Cortex v3.1)</h4>
                                                </div>
                                                <textarea 
                                                    value={aiPrompt} 
                                                    onChange={e => setAiPrompt(e.target.value)}
                                                    rows={15}
                                                    className="w-full bg-stone-900/50 border-4 border-white/5 rounded-[2rem] p-10 font-bold text-sm leading-relaxed text-stone-200 focus:border-rose-500 focus:outline-none transition-all resize-none"
                                                />
                                                <p className="mt-6 text-[10px] font-black uppercase tracking-widest opacity-50 italic">Attention : toute modification impacte directement la qualité éditoriale du Radar.</p>
                                            </div>
                                        )}

                                        {settingsTab === 'sociaux' && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="bg-stone-50 p-8 rounded-[2rem] border-4 border-stone-100">
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6">Canaux de Diffusion</h4>
                                                    <div className="space-y-2">
                                                        <SettingRow label="Mastodon" tooltip="Activer le broadcast auto sur le Fediverse"><Toggle checked={socialMastodonEnabled} onChange={setSocialMastodonEnabled} /></SettingRow>
                                                        <SettingRow label="Bluesky" tooltip="Envoyer les brèves sur BlueSky"><Toggle checked={socialBlueskyEnabled} onChange={setSocialBlueskyEnabled} /></SettingRow>
                                                        <SettingRow label="X / Twitter" tooltip="Utiliser l'API bradée pour Twitter"><Toggle checked={socialTwitterEnabled} onChange={setSocialTwitterEnabled} /></SettingRow>
                                                        <SettingRow label="Discord Webhook" tooltip="Poster une preview riche sur le serveur discord Radar"><Toggle checked={socialDiscordEnabled} onChange={setSocialDiscordEnabled} /></SettingRow>
                                                    </div>
                                                </div>
                                                <div className="bg-stone-50 p-8 rounded-[2rem] border-4 border-stone-100">
                                                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6">Paramètres Diffusion</h4>
                                                    <SettingRow label="Discord Test Mode" tooltip="Envoi sur un canal de debug"><Toggle checked={discordTestMode} onChange={setDiscordTestMode} /></SettingRow>
                                                    <div className="mt-8 space-y-4">
                                                        <div>
                                                            <label className="text-[10px] font-black uppercase mb-1 block">Brèves Max par Scan</label>
                                                            <input type="number" value={maxArticles} onChange={e=>setMaxArticles(parseInt(e.target.value))} className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-2 font-black" />
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase mb-1 block">Délai Min (m)</label>
                                                                <input type="number" value={minDelay} onChange={e=>setMinDelay(parseInt(e.target.value))} className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-2 font-black" />
                                                            </div>
                                                            <div>
                                                                <label className="text-[10px] font-black uppercase mb-1 block">Délai Max (m)</label>
                                                                <input type="number" value={maxDelay} onChange={e=>setMaxDelay(parseInt(e.target.value))} className="w-full bg-white border-2 border-stone-200 rounded-xl px-4 py-2 font-black" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {activeTab === 'CONSOLE' ? <ConsoleTab /> : activeTab === 'STUDIO' ? <StudioSocialTab /> : activeTab === 'TEST_IA' ? <TestIATab /> : (
                                    <div className="space-y-8 animate-in fade-in">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border-4 border-stone-900 shadow-[12px_12px_0px_0px_rgba(0,0,0,0.1)]">
                                            <div className="flex flex-wrap items-center gap-4">
                                                <div className="flex rounded-2xl border-4 border-stone-900 bg-stone-100 overflow-hidden text-[10px] font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                                    {(['france', 'international', 'all'] as const).map(key => (
                                                        <button
                                                            key={key}
                                                            onClick={() => setGeoFilter(key)}
                                                            className={`px-6 py-3 transition-all border-r-4 last:border-r-0 border-stone-900 ${geoFilter === key ? 'bg-stone-900 text-white' : 'text-stone-400 hover:text-stone-900 hover:bg-white'}`}
                                                        >
                                                            {key === 'france' ? '🇫🇷' : key === 'international' ? '🌍' : 'Tous'}
                                                        </button>
                                                    ))}
                                                </div>
                                                {trendingTags.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {trendingTags.map(({ tag, count }) => (
                                                            <button
                                                                key={tag}
                                                                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                                                                className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2 ${activeTag === tag ? 'bg-rose-600 text-white border-rose-500 shadow-lg scale-110' : 'bg-stone-50 text-stone-400 border-stone-100 hover:border-stone-300'}`}
                                                            >
                                                                #{tag} <span className="opacity-50 ml-1">{count}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <span className="text-xs font-black uppercase tracking-[0.2em] text-stone-300">{posts.length} Résultat{posts.length !== 1 ? 's' : ''}</span>
                                                <button onClick={fetchQueue} className="w-12 h-12 bg-white border-4 border-stone-100 rounded-2xl flex items-center justify-center hover:border-stone-900 transition-all active:rotate-180">🔄</button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-8">
                                            {loading ? (
                                                <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-30">
                                                    <div className="w-20 h-20 border-8 border-stone-900 border-t-rose-500 rounded-full animate-spin" />
                                                    <p className="text-xs font-black uppercase tracking-[0.4em]">Chargement des Archives...</p>
                                                </div>
                                            ) : posts.length === 0 ? (
                                                <div className="text-center py-40 bg-white rounded-[3rem] border-8 border-dashed border-stone-100">
                                                    <span className="text-6xl mb-8 block">📭</span>
                                                    <p className="text-xl font-black text-stone-200 uppercase tracking-widest">Le radar est calme pour le moment.</p>
                                                    <button onClick={triggerGeneration} disabled={isTriggering} className="mt-8 px-10 py-5 bg-rose-600 text-white font-black uppercase tracking-widest text-xs rounded-2xl border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-y-1 transition-all">Relancer le Scan 🚀</button>
                                                </div>
                                            ) : (
                                                <div className="grid grid-cols-1 gap-10">
                                                    {posts.map(post => (
                                                        <RadarCard 
                                                            key={post.id} 
                                                            post={post} 
                                                            onUpdate={handleUpdateStatus} 
                                                            activeTab={activeTab}
                                                            isSelected={selectedIds.includes(post.id)}
                                                            onToggleSelect={(id, sel) => {
                                                                if (sel) setSelectedIds(prev => [...prev, id]);
                                                                else setSelectedIds(prev => prev.filter(i => i !== id));
                                                            }}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* Bulk Action Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }}
                        className="fixed bottom-0 left-0 right-0 p-8 z-[60] pointer-events-none"
                    >
                        <div className="max-w-5xl mx-auto bg-stone-900 border-8 border-stone-800 rounded-[2.5rem] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-3xl bg-stone-900/95">
                            <div className="flex items-center gap-6">
                                <div className="w-16 h-16 bg-rose-600 rounded-[1.2rem] flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-rose-500/20">{selectedIds.length}</div>
                                <div>
                                    <h4 className="text-white font-black uppercase tracking-tighter text-xl">Articles Sélectionnés</h4>
                                    <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mt-1">Actions groupées en attente</p>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-3">
                                <button onClick={() => setSelectedIds([])} className="px-6 py-4 rounded-xl font-black uppercase tracking-widest text-[10px] text-stone-500 hover:text-white transition-colors">Annuler</button>
                                <button onClick={() => handleBulkStatus('APPROVED')} className="px-6 py-4 rounded-2xl bg-stone-800 text-amber-500 font-black uppercase tracking-widest text-[10px] border-4 border-stone-700 hover:bg-stone-700 transition-all">🕒 Approuver</button>
                                <button onClick={() => handleBulkStatus('REJECTED')} className="px-6 py-4 rounded-2xl bg-stone-800 text-stone-400 font-black uppercase tracking-widest text-[10px] border-4 border-stone-700 hover:bg-rose-500/20 hover:text-rose-500 hover:border-rose-500/30 transition-all">🗑️ Poubelle</button>
                                <button onClick={() => handleBulkStatus('PUBLISHED')} className="px-10 py-4 bg-rose-600 text-white border-4 border-white/20 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-2xl hover:bg-rose-700 transition-all scale-105">LANCER LA DIFFUSION 🚀</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}