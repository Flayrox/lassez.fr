'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RadarPost {
    id: number;
    source_url: string;
    source_title: string;
    flash_content: string;
    image_keyword: string | null;
    geo: string | null;
    tags: string | null;
    created_at: string;
}

// ─── Infobulle UI ───────────────────────────────────────────────
function TooltipInfo({ text, position = 'top' }: { text: string; position?: 'top' | 'bottom' }) {
    return (
        <div className="group relative inline-flex items-center justify-center">
            <span className="cursor-help w-3.5 h-3.5 rounded-full border border-stone-300 flex items-center justify-center text-[9px] font-bold text-stone-400 group-hover:bg-stone-200 group-hover:text-stone-700 transition-colors">
                i
            </span>
            <div className={`absolute ${position === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'} left-1/2 -translate-x-1/2 w-56 p-2.5 bg-stone-900 font-medium text-stone-100 text-[11px] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none text-center leading-relaxed backdrop-blur-sm bg-stone-900/95`}>
                {text}
                <div className={`absolute ${position === 'top' ? 'top-full border-t-stone-900/95' : 'bottom-full border-b-stone-900/95'} left-1/2 -translate-x-1/2 border-4 border-transparent`} />
            </div>
        </div>
    );
}

// ─── Petit toggle switch UI ───────────────────────────────────
function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            onClick={() => !disabled && onChange(!checked)}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-rose-600' : 'bg-stone-200'}`}
        >
            <span className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
    );
}

// ─── Setting row dans le panneau ──────────────────────────────
function SettingRow({ label, tooltip, description, children }: { label: string; tooltip?: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3.5 border-b border-stone-100 last:border-0">
            <div className="min-w-0 pr-4">
                <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-stone-800">{label}</p>
                    {tooltip && <TooltipInfo text={tooltip} />}
                </div>
                {description && <p className="text-xs text-stone-400 mt-1 leading-relaxed">{description}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

// ─── Badge de statut du mode actuel ──────────────────────────
function StatusBadge({ isAutoApprove, isAutoPilot }: { isAutoApprove: boolean; isAutoPilot: boolean }) {
    if (isAutoApprove && isAutoPilot) return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Mode Fantôme — 100% automatique
        </span>
    );
    if (isAutoPilot) return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Pilote auto — validation manuelle requise
        </span>
    );
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-500 border border-stone-200">
            <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
            Mode manuel
        </span>
    );
}

// ─── CONSOLE TAB ──────────────────────────────────────────────
function ConsoleTab() {
    const [logs, setLogs] = useState<string[]>([]);
    const [filter, setFilter] = useState('TOUT');
    const [health, setHealth] = useState<any>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchLogs = async () => {
        try {
            const res = await fetch('/api/radar/logs');
            const data = await res.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (e) {
            console.error("Failed to fetch logs", e);
        }
    };

    const fetchHealth = async () => {
        try {
            const res = await fetch('/api/radar/health');
            const data = await res.json();
            if (data.success) {
                setHealth(data.health);
            }
        } catch (e) {
            console.error("Failed to fetch health", e);
        }
    };

    useEffect(() => {
        fetchLogs();
        const intervalLogs = setInterval(fetchLogs, 5000);
        
        fetchHealth();
        const intervalHealth = setInterval(fetchHealth, 30000);
        
        return () => {
            clearInterval(intervalLogs);
            clearInterval(intervalHealth);
        };
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const renderHealthBadge = (key: string, label: string) => {
        if (!health || !health[key]) return null;
        const { status, message } = health[key];
        
        let colorClass = 'bg-stone-100 text-stone-500 border-stone-200';
        let dotColor = 'bg-stone-300';
        
        if (status === 'loading') {
            colorClass = 'bg-blue-50 text-blue-600 border-blue-200';
            dotColor = 'bg-blue-500 animate-pulse';
        } else if (status === 'ok') {
            colorClass = 'bg-green-50 text-green-700 border-green-200';
            dotColor = 'bg-green-500';
        } else if (status === 'error') {
            colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
            dotColor = 'bg-rose-500';
        }

        return (
            <div className={`flex flex-col p-3 rounded-xl border ${colorClass} transition-colors`}>
                <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${dotColor}`} />
                    <span className="text-xs font-bold uppercase tracking-wider">{label}</span>
                </div>
                <span className="text-[10px] sm:text-xs font-medium opacity-80 leading-tight">
                    {message || "En attente..."}
                </span>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden shadow-2xl">
                <div className="px-4 py-2 bg-stone-800 border-b border-stone-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                        <span className="text-xs font-mono text-stone-400 uppercase tracking-widest hidden sm:inline">Live System Logs</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {['TOUT', 'ÉLECTIONS', 'DAEMON', 'WORDPRESS', 'ERREURS'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`text-[10px] px-2 py-1 rounded font-mono transition-colors shadow-sm ${filter === f ? 'bg-rose-600 text-white font-bold' : 'bg-stone-700 text-stone-300 hover:bg-stone-600'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
                <div 
                    ref={scrollRef}
                    className="p-6 h-[500px] overflow-y-auto font-mono text-xs leading-relaxed text-stone-300 selection:bg-rose-500/30"
                >
                    {logs.map((line, i) => {
                        let show = true;
                        if (filter === 'ÉLECTIONS') show = line.includes('[Élections]') || line.includes('[DAEMON-PROXY]');
                        else if (filter === 'DAEMON') show = line.includes('[DAEMON]') || line.includes('[DAEMON-AUTO]');
                        else if (filter === 'WORDPRESS') show = line.includes('[WP-') || line.toLowerCase().includes('wordpress');
                        else if (filter === 'ERREURS') show = line.toLowerCase().includes('error') || line.toLowerCase().includes('échec') || line.toLowerCase().includes('erreur') || line.toLowerCase().includes('fail');
                        
                        if (!show) return null;

                        return (
                            <div key={i} className="hover:bg-stone-800/50 transition-colors py-0.5 flex">
                                <span className="text-stone-600 mr-4 select-none w-8 text-right shrink-0">{(i + 1).toString().padStart(3, '0')}</span>
                                <span className="break-all">{line}</span>
                            </div>
                        );
                    })}
                    {logs.length === 0 && <div className="text-stone-600 italic">Waiting for logs...</div>}
                </div>
            </div>

            <div className="bg-white rounded-2xl border-4 border-stone-900 p-6 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                <h3 className="text-xl font-black uppercase tracking-tighter mb-4 italic">État du Système</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {renderHealthBadge('database', 'Base de Données')}
                    {renderHealthBadge('daemon', 'Daemon & Pilote')}
                    {renderHealthBadge('gemini', 'Gemini IA')}
                    {renderHealthBadge('wordpress', 'WordPress')}
                    {renderHealthBadge('mastodon', 'Mastodon')}
                    {renderHealthBadge('bluesky', 'Bluesky')}
                    {renderHealthBadge('twitter', 'X / Twitter')}
                </div>
            </div>
        </div>
    );
}

// ─── STUDIO SOCIAL TAB ────────────────────────────────────────
function StudioSocialTab() {
    const [text, setText] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [drafts, setDrafts] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const fetchDrafts = async () => {
        try {
            const res = await fetch('/api/radar/social-custom');
            const data = await res.json();
            if (data.success) setDrafts(data.drafts);
        } catch (e) {}
    };

    useEffect(() => {
        fetchDrafts();
    }, []);

    const handlePost = async (broadcastNow: boolean) => {
        if (!text) return;
        if (broadcastNow) setIsBroadcasting(true);
        else setIsSaving(true);

        try {
            const res = await fetch('/api/radar/social-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, image_url: imageUrl, broadcast_now: broadcastNow })
            });
            const data = await res.json();
            if (data.success) {
                if (!broadcastNow) {
                    setText('');
                    setImageUrl('');
                }
                fetchDrafts();
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert("Erreur réseau");
        } finally {
            setIsSaving(false);
            setIsBroadcasting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white rounded-2xl border-4 border-stone-900 p-6 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                    <h3 className="text-xl font-black uppercase tracking-tighter mb-4 italic">Nouveau Broadcast</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Message (X / Telegram)</label>
                            <textarea 
                                value={text}
                                onChange={e => setText(e.target.value)}
                                rows={8}
                                className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl p-4 font-medium text-stone-800 focus:border-rose-500 focus:ring-0 transition-colors resize-none"
                                placeholder="Quoi de neuf sur le front ?"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Image URL (Optionnel)</label>
                            <input 
                                type="text"
                                value={imageUrl}
                                onChange={e => setImageUrl(e.target.value)}
                                className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl px-4 py-3 font-medium text-stone-800 focus:border-rose-500 focus:ring-0 transition-colors"
                                placeholder="https://..."
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => handlePost(false)}
                                disabled={isSaving || isBroadcasting || !text}
                                className="flex-1 px-6 py-4 bg-stone-100 hover:bg-stone-200 text-stone-900 font-black uppercase tracking-widest rounded-xl border-2 border-stone-900 transition-all active:translate-y-1 active:shadow-none disabled:opacity-50"
                            >
                                {isSaving ? '...' : 'Enregistrer Brouillon'}
                            </button>
                            <button 
                                onClick={() => handlePost(true)}
                                disabled={isSaving || isBroadcasting || !text}
                                className="flex-1 px-6 py-4 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] transition-all active:translate-y-1 active:shadow-none disabled:opacity-50"
                            >
                                {isBroadcasting ? 'Diffusion...' : 'Diffuser Maintenant'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h3 className="text-xl font-black uppercase tracking-tighter italic">Historique</h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {drafts.map((draft: any) => (
                        <div key={draft.id} className="bg-white border-2 border-stone-200 rounded-xl p-4 hover:border-stone-400 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase ${draft.status === 'PUBLISHED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {draft.status}
                                </span>
                                <span className="text-[10px] font-mono text-stone-400">
                                    {new Date(draft.created_at).toLocaleDateString()}
                                </span>
                            </div>
                            <p className="text-sm text-stone-600 line-clamp-3 mb-2">{draft.text}</p>
                            {draft.image_url && (
                                <img src={draft.image_url} className="w-full h-20 object-cover rounded-lg border border-stone-100" alt="" />
                            )}
                        </div>
                    ))}
                    {drafts.length === 0 && <p className="text-stone-400 text-sm italic">Aucun historique.</p>}
                </div>
            </div>
        </div>
    );
}

function TestIATab() {
    const [text, setText] = useState('');
    const [results, setResults] = useState<any[] | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        if (!text.trim()) return;
        setIsTesting(true);
        setError(null);
        setResults(null);
        try {
            const res = await fetch('/api/radar/test-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textToTest: text })
            });
            const data = await res.json();
            if (data.success) {
                setResults(data.results);
            } else {
                setError(data.error || 'Erreur inconnue');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl border-4 border-stone-900 p-6 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-4 italic">Laboratoire IA (Prompt Tester)</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Article à soumettre (Texte brut)</label>
                        <textarea 
                            value={text}
                            onChange={e => setText(e.target.value)}
                            rows={15}
                            className="w-full bg-stone-50 border-2 border-stone-200 rounded-xl p-4 font-medium text-sm text-stone-800 focus:border-purple-500 focus:ring-0 transition-colors resize-none"
                            placeholder="Collez ici le contenu d'une dépêche ou d'un article pour tester la réaction de l'IA avec le prompt configuré..."
                        />
                    </div>
                    <button 
                        onClick={handleTest}
                        disabled={isTesting || !text.trim()}
                        className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest rounded-xl border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] transition-all active:translate-y-1 active:shadow-none disabled:opacity-50"
                    >
                        {isTesting ? 'Analyse en cours (Gemini Search)...' : 'Lancer le test IA'}
                    </button>
                    {error && <p className="text-rose-600 text-sm font-bold bg-rose-50 p-3 rounded-lg">{error}</p>}
                </div>
                
                <div className="space-y-4">
                    <label className="block text-xs font-black uppercase tracking-widest text-stone-400 mb-2">Résultat (JSON Flash)</label>
                    <div className="bg-stone-900 text-stone-300 font-mono text-xs rounded-xl p-4 h-[440px] overflow-y-auto border-2 border-stone-800">
                        {isTesting ? (
                            <div className="flex items-center justify-center h-full animate-pulse text-stone-500">
                                Traitement par Gemini en cours...
                            </div>
                        ) : results ? (
                            <pre className="whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
                        ) : (
                            <div className="flex items-center justify-center h-full text-stone-600 italic">
                                Le résultat apparaîtra ici
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

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

    // --- Nouveaux Paramètres Modulaires ---
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
    
    // --- Nouveaux Panels de Paramètres ---
    const [settingsTab, setSettingsTab] = useState<'sources' | 'moteur' | 'sociaux' | 'sante' | 'comm'>('sources');
    const [lastScanErrors, setLastScanErrors] = useState<{source: string, type: string, error: string}[]>([]);

    // --- Communication Settings ---
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [maintenanceMessage, setMaintenanceMessage] = useState('');
    const [popupEnabled, setPopupEnabled] = useState(false);
    const [popupTitle, setPopupTitle] = useState('');
    const [popupText, setPopupText] = useState('');
    const [popupLinkUrl, setPopupLinkUrl] = useState('');
    const [popupLinkLabel, setPopupLinkLabel] = useState('');

    // ─── État Rubriques ──────────────────────────────────────
    const [navItems, setNavItems] = useState<{ slug: string; label: string; path: string; enabled: boolean; badge: string | null }[]>([]);
    const [showNavSection, setShowNavSection] = useState(false);
    const [navSaving, setNavSaving] = useState<string | null>(null);

    // ─── État Élections (nouveau schéma : nuances, statuts, tours) ───
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
                // Mise à jour de l'état local uniquement en cas de succès
                setNavItems(prev => prev.map(item => item.slug === slug ? { ...item, enabled } : item));
                
                // Invalidation immédiate du cache local
                sessionStorage.removeItem('lassez_nav');
                sessionStorage.removeItem('lassez_nav_at');
                
                // Petit feedback visuel (optionnel, on pourrait ajouter un toast)
                console.log(`Radar-Admin: ${slug} ${enabled ? 'activé' : 'désactivé'}`);
            } else {
                alert(`Erreur: ${data.error || 'Impossible de mettre à jour la rubrique.'}`);
            }
        } catch (e: any) {
            console.error('Erreur réseau Radar-Admin:', e);
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
                
                if (data.settings?.last_scan_errors) {
                    try { setLastScanErrors(JSON.parse(data.settings.last_scan_errors)); } catch(e){}
                }

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
        const intervalSettings = setInterval(fetchSettings, 20000); // Polling toutes les 20s
        return () => clearInterval(intervalSettings);
    }, []);

    // Ticker qui met à jour le countdown toutes les secondes
    useEffect(() => {
        const tick = () => {
            if (!nextScanAt) { setCountdown(null); return; }
            const diffMs = nextScanAt.getTime() - Date.now();
            
            // Si le scan est prévu pour "maintenant" ou le passé récent, c'est qu'il tourne probablement
            if (diffMs <= 0 && diffMs > -(5 * 60 * 1000)) { 
                setCountdown('Scanner en cours… ⚙️'); 
                return; 
            }
            if (diffMs <= - (5 * 60 * 1000)) {
                setCountdown('Daemon en attente…');
                return;
            }

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
        if (!confirm("Lancer manuellement l'IA va consommer du crédit Gemini. Continuer ?")) return;
        setIsTriggering(true);
        setTriggerLogs("Connexion au script Radar en cours…\n");
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
        } catch (e: any) {
            setTriggerLogs(prev => (prev || "") + "\n❌ Erreur : " + e.message);
        }
        setIsTriggering(false);
    };

    const injectTestArticle = async () => {
        setIsTriggering(true);
        try {
            const res = await fetch('/api/radar/test-inject', { method: 'POST' });
            if (res.ok) { setActiveTab('PENDING'); fetchQueue(); }
            else alert("Erreur lors de l'injection du test");
        } catch { alert('Erreur réseau'); }
        setIsTriggering(false);
    };

    const testDiscordImages = async () => {
        setIsTriggering(true);
        setTriggerLogs("Génération d'images de test en cours...\n");
        try {
            const res = await fetch('/api/radar/test-images', { method: 'POST' });
            if (res.ok) {
                setTriggerLogs(prev => (prev || "") + "✅ Images générées avec succès et envoyées au webhook discord.\n");
                alert("Images de test générées et envoyées !");
            } else {
                alert("Erreur lors de la génération des images.");
            }
        } catch { alert('Erreur réseau'); }
        setIsTriggering(false);
    };


    const fetchQueue = async () => {
        setSelectedIds([]);
        if (activeTab === 'CONSOLE' || activeTab === 'STUDIO') return;
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

    const handleUpdateStatus = async (id: number, status: 'APPROVED' | 'REJECTED' | 'PUBLISHED', newContent?: string, newImageUrl?: string, newTitle?: string) => {
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
        if (!confirm(`Appliquer le statut ${status} à ${selectedIds.length} article(s) ?`)) return;
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
        { key: 'PENDING', label: 'À modérer', color: 'text-rose-600' },
        { key: 'APPROVED', label: 'En file', color: 'text-amber-600' },
        { key: 'PUBLISHED', label: 'Publiés', color: 'text-green-600' },
        { key: 'REJECTED', label: 'Rejetés', color: 'text-stone-400' },
        { key: 'IGNORED', label: 'Annexe', color: 'text-stone-400' },
        { key: 'CONSOLE', label: 'Console', color: 'text-stone-600' },
        { key: 'STUDIO', label: 'Studio Social', color: 'text-rose-600' },
        { key: 'TEST_IA', label: 'Labo IA', color: 'text-purple-600' },
    ] as const;

    return (
        <div className="min-h-screen bg-stone-50 text-stone-900" style={{ fontFamily: "var(--font-inter), 'Helvetica Neue', sans-serif" }}>

            {/* ── HEADER ─────────────────────────────────── */}
            <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
                <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                        <span className="font-bold text-stone-900 text-sm tracking-tight">Radar L'Assez</span>
                        <StatusBadge isAutoApprove={isAutoApprove} isAutoPilot={isAutoPilot} />
                        {isAutoPilot && countdown && (
                            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-stone-400 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-stone-300" />
                                {countdown}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative flex items-center gap-1.5 mr-2">
                            <button
                                onClick={isTriggering ? undefined : triggerGeneration}
                                disabled={isTriggering}
                                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition-colors disabled:opacity-50"
                            >
                                {isTriggering ? '⟳ En cours…' : '⚡ Lancer scan IA'}
                            </button>
                            <TooltipInfo text="Force le daemon à scanner les flux RSS et Telegram immédiatement, et lance l'IA Gemini pour générer de nouveaux flashs. Attention : consomme du crédit d'API." position="bottom" />
                        </div>
                        <button
                            onClick={() => setShowSettings(s => !s)}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${showSettings ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'}`}
                        >
                            ⚙️ Paramètres
                        </button>
                        <button
                            onClick={() => { setShowNavSection(s => !s); setShowElectionsSection(false); }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${showNavSection ? 'bg-stone-900 text-white border-stone-900' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'}`}
                        >
                            🗂 Rubriques
                        </button>
                        <button
                            onClick={() => { setShowElectionsSection(s => !s); setShowNavSection(false); }}
                            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${showElectionsSection ? 'bg-rose-600 text-white border-rose-600' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'}`}
                        >
                            🗳 Élections
                        </button>
                        <button
                            onClick={async () => { await fetch('/api/radar/logout', { method: 'POST' }); window.location.href = '/radar-login'; }}
                            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-stone-500 transition-colors"
                        >
                            Quitter
                        </button>
                    </div>
                </div>
            </header>

            {/* ── PANNEAU PARAMÈTRES ─────────────────────── */}
            <AnimatePresence>
                {showSettings && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="bg-white border-b border-stone-200 shadow-sm"
                    >
                        <div className="flex border-b border-stone-100 bg-stone-50 overflow-x-auto">
                            <button onClick={() => setSettingsTab('sources')} className={`px-5 py-3 text-sm font-semibold transition-colors flex-shrink-0 ${settingsTab === 'sources' ? 'border-b-2 border-rose-600 text-rose-600 bg-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}>🤖 Sources & Cerveau</button>
                            <button onClick={() => setSettingsTab('moteur')} className={`px-5 py-3 text-sm font-semibold transition-colors flex-shrink-0 ${settingsTab === 'moteur' ? 'border-b-2 border-rose-600 text-rose-600 bg-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}>⚙️ Moteur & Auto</button>
                            <button onClick={() => setSettingsTab('sociaux')} className={`px-5 py-3 text-sm font-semibold transition-colors flex-shrink-0 ${settingsTab === 'sociaux' ? 'border-b-2 border-rose-600 text-rose-600 bg-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}>🌍 Sociaux & Daemons</button>
                            <button onClick={() => setSettingsTab('comm')} className={`px-5 py-3 text-sm font-semibold transition-colors flex-shrink-0 ${settingsTab === 'comm' ? 'border-b-2 border-rose-600 text-rose-600 bg-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}>📢 Communication</button>
                            <button onClick={() => setSettingsTab('sante')} className={`px-5 py-3 text-sm font-semibold transition-colors flex-shrink-0 ${settingsTab === 'sante' ? 'border-b-2 border-rose-600 text-rose-600 bg-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white'}`}>🩺 Santé du Radar</button>
                        </div>

                        <div className="max-w-5xl mx-auto px-6 py-6 min-h-[400px]">
                            {settingsTab === 'sources' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-stone-700 mb-1">Flux RSS (1 URL par ligne)</label>
                                            <textarea 
                                                value={rssFeeds}
                                                onChange={e => setRssFeeds(e.target.value)}
                                                rows={5}
                                                className="w-full text-xs font-mono border border-stone-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-400/30"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-stone-700 mb-1">Chaînes Telegram (1 ID par ligne)</label>
                                            <textarea 
                                                value={telegramChannels}
                                                onChange={e => setTelegramChannels(e.target.value)}
                                                rows={3}
                                                className="w-full text-xs font-mono border border-stone-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-400/30"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-stone-700 mb-1">Cerveau IA (Prompt System Gemini)</label>
                                        <p className="text-[10px] text-stone-400 mb-2 leading-tight">Définis ici les règles éditoriales, le ton et les priorités de sélection. L'IA appliquera ces règles aux dépêches scannées.</p>
                                        <textarea 
                                            value={aiPrompt}
                                            onChange={e => setAiPrompt(e.target.value)}
                                            rows={14}
                                            className="w-full text-xs leading-relaxed border border-stone-200 rounded-lg p-3 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-rose-400/30 transition-colors shadow-inner"
                                        />
                                    </div>
                                </motion.div>
                            )}

                            {settingsTab === 'moteur' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2 mt-4">Automatisations</h4>
                                        <SettingRow label="Mode Pilote Auto" tooltip="Si activé, le daemon publiéra automatiquement les articles approuvés sur WordPress selon les délais configurés.">
                                            <Toggle checked={isAutoPilot} onChange={v => setIsAutoPilot(v)} />
                                        </SettingRow>
                                        <SettingRow label="Auto-Approbation IA" tooltip="ATTENTION : L'IA approuvera elle-même ses flashs (Mode Fantôme). Aucun contrôle humain avant publication !">
                                            <Toggle checked={isAutoApprove} onChange={v => setIsAutoApprove(v)} />
                                        </SettingRow>
                                        
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 mt-6">Limites Scraper</h4>
                                        <div className="py-3 flex flex-col gap-2 border-b border-stone-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5"><p className="text-sm font-medium text-stone-800">Articles max par scan</p><TooltipInfo text="Nombre maximum d'articles envoyés à l'IA." /></div>
                                                <span className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">{maxArticles} Articles</span>
                                            </div>
                                            <input type="range" min="1" max="100" step="1" value={maxArticles} onChange={e => setMaxArticles(parseInt(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer hover:accent-rose-500" />
                                        </div>
                                        <div className="py-3 flex flex-col gap-2 border-b border-stone-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5"><p className="text-sm font-medium text-stone-800">Historique RSS</p><TooltipInfo text="Recul du scan IA." /></div>
                                                <span className="text-sm font-black text-stone-700 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">{rssLookbackHours} Heures</span>
                                            </div>
                                            <input type="range" min="1" max="72" step="1" value={rssLookbackHours} onChange={e => setRssLookbackHours(parseInt(e.target.value))} className="w-full accent-stone-700 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer hover:accent-stone-600" />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 mt-4">Fréquences & Tempo</h4>
                                        <div className="py-3 flex flex-col gap-2 border-b border-stone-100">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5"><p className="text-sm font-medium text-stone-800">Intervalle Scan Général (Minutes)</p></div>
                                                <span className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">{scanIntervalMin} Minutes</span>
                                            </div>
                                            <input type="range" min="5" max="2880" step="5" value={scanIntervalMin} onChange={e => setScanIntervalMin(parseInt(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer hover:accent-rose-500" />
                                        </div>
                                        
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 mt-6">Délai Anti-Bot</h4>
                                        <p className="text-[10px] text-stone-400 mb-2 leading-tight">Délai de publication aléatoire généré entre l'approbation et l'envoi WordPress.</p>
                                        
                                        <div className="py-3 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] uppercase font-bold text-stone-400">Entre (Min)</span>
                                                <span className="text-sm font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">{minDelay} minutes</span>
                                            </div>
                                            <input type="range" min="0" max="60" step="1" value={minDelay} onChange={e => setMinDelay(parseInt(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer" />
                                            
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="text-[10px] uppercase font-bold text-stone-400">Et (Max)</span>
                                                <span className="text-sm font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">{maxDelay} minutes</span>
                                            </div>
                                            <input type="range" min="1" max="180" step="1" value={maxDelay} onChange={e => setMaxDelay(parseInt(e.target.value))} className="w-full accent-amber-500 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {settingsTab === 'sociaux' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 mt-4">Services Actifs (Daemons)</h4>
                                        <SettingRow label="Daemon Scan RSS" description="Active la boucle de récolte automatique.">
                                            <Toggle checked={daemonRssEnabled} onChange={v => setDaemonRssEnabled(v)} />
                                        </SettingRow>
                                        <SettingRow label="Daemon Élections" description="Active la récupération des résultats électoraux.">
                                            <Toggle checked={daemonElectionsEnabled} onChange={v => setDaemonElectionsEnabled(v)} />
                                        </SettingRow>
                                        
                                        <div className="py-3 flex flex-col gap-2 border-b border-stone-100 mt-2">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5"><p className="text-sm font-medium text-stone-800">Intervalle Sync Élections</p></div>
                                                <span className="text-sm font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">{electionIntervalHours} Heure(s)</span>
                                            </div>
                                            <input type="range" min="0.5" max="24" step="0.5" value={electionIntervalHours} onChange={e => setElectionIntervalHours(parseFloat(e.target.value))} className="w-full accent-rose-600 h-1.5 bg-stone-200 rounded-lg appearance-none cursor-pointer hover:accent-rose-500" />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 mt-4">Réseaux Sociaux (Broadcast)</h4>
                                        <SettingRow label="Mastodon" description="Publier les flashs sur l'instance configurée.">
                                            <Toggle checked={socialMastodonEnabled} onChange={v => setSocialMastodonEnabled(v)} />
                                        </SettingRow>
                                        <SettingRow label="Bluesky" description="Publier les flashs sur AT Protocol.">
                                            <Toggle checked={socialBlueskyEnabled} onChange={v => setSocialBlueskyEnabled(v)} />
                                        </SettingRow>
                                        <SettingRow label="X / Twitter" description="Publier les flashs via l'API Twitter v2.">
                                            <Toggle checked={socialTwitterEnabled} onChange={v => setSocialTwitterEnabled(v)} />
                                        </SettingRow>
                                        <SettingRow label="Discord" description="Publier les flashs via Webhook (Test ou Prod).">
                                            <Toggle checked={socialDiscordEnabled} onChange={v => setSocialDiscordEnabled(v)} />
                                        </SettingRow>
                                        <SettingRow label="Mode Test (Discord)" description="Envoie des fiches détaillées plutôt que des alertes simples.">
                                            <Toggle checked={discordTestMode} onChange={v => setDiscordTestMode(v)} />
                                        </SettingRow>
                                    </div>
                                </motion.div>
                            )}

                            {settingsTab === 'comm' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-6">
                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-2 mt-4">⚙️ Mode Maintenance</h4>
                                        <SettingRow label="Activer la Maintenance" description="Bloque tout le site public et affiche le message de maintenance.">
                                            <Toggle checked={maintenanceMode} onChange={v => setMaintenanceMode(v)} />
                                        </SettingRow>
                                        <div className="pt-2">
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Message de maintenance</label>
                                            <textarea 
                                                value={maintenanceMessage}
                                                onChange={e => setMaintenanceMessage(e.target.value)}
                                                rows={4}
                                                placeholder="Pourquoi le site est en pause ?"
                                                className="w-full text-xs border border-stone-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-400/30"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-sky-500 mb-2 mt-4">✨ Fenêtre Pop-up Publicitaire</h4>
                                        <SettingRow label="Activer la Pop-up" description="Affiche une fenêtre modale à tous les lecteurs.">
                                            <Toggle checked={popupEnabled} onChange={v => setPopupEnabled(v)} />
                                        </SettingRow>
                                        <div className="pt-2 space-y-3">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Titre de la pop-up</label>
                                                <input 
                                                    type="text" value={popupTitle} onChange={e => setPopupTitle(e.target.value)}
                                                    className="w-full text-xs font-bold border border-stone-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-400/30"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Texte de la pop-up</label>
                                                <textarea 
                                                    value={popupText} onChange={e => setPopupText(e.target.value)}
                                                    rows={3} className="w-full text-xs border border-stone-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-400/30"
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Label du bouton</label>
                                                    <input 
                                                        type="text" value={popupLinkLabel} onChange={e => setPopupLinkLabel(e.target.value)}
                                                        className="w-full text-xs border border-stone-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-400/30"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-widest text-stone-400 mb-1">Lien du bouton</label>
                                                    <input 
                                                        type="text" value={popupLinkUrl} onChange={e => setPopupLinkUrl(e.target.value)}
                                                        className="w-full text-xs border border-stone-200 rounded-lg p-2 focus:ring-2 focus:ring-rose-400/30"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {settingsTab === 'sante' && (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-stone-400">Erreurs du dernier scan</h4>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lastScanErrors.length > 0 ? 'bg-rose-100 text-rose-600' : 'bg-green-100 text-green-600'}`}>
                                            {lastScanErrors.length} erreur(s) détectée(s)
                                        </span>
                                    </div>
                                    
                                    <div className="border border-stone-100 rounded-xl overflow-hidden shadow-sm">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-stone-50 text-stone-400 uppercase font-black tracking-widest border-b border-stone-100">
                                                <tr>
                                                    <th className="px-4 py-3">Source / Handle</th>
                                                    <th className="px-4 py-3">Type</th>
                                                    <th className="px-4 py-3">Détail de l'erreur</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-50 bg-white">
                                                {lastScanErrors.map((err, i) => (
                                                    <tr key={i} className="hover:bg-stone-50 transition-colors">
                                                        <td className="px-4 py-3 font-mono text-stone-600 truncate max-w-[200px]">{err.source}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${err.type === 'RSS' ? 'bg-blue-50 text-blue-600' : 'bg-sky-50 text-sky-600'}`}>{err.type}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-rose-600 font-medium italic">{err.error}</td>
                                                    </tr>
                                                ))}
                                                {lastScanErrors.length === 0 && (
                                                    <tr>
                                                        <td colSpan={3} className="px-4 py-8 text-center text-stone-300 italic">Aucune erreur lors du dernier cycle.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                    <div className="bg-stone-50 p-4 rounded-xl border border-stone-100">
                                        <p className="text-xs text-stone-500 leading-relaxed italic">
                                            💡 Les erreurs de scan sont normales si certaines sources sont temporairement instables ou bloquées par un firewall. Le daemon retentera automatiquement lors du prochain cycle.
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* Bouton global de sauvegarde */}
                            <div className="md:col-span-2 pt-6 flex flex-col items-center border-t border-stone-200 mt-6 pb-2">
                                <button
                                    onClick={saveSettings}
                                    disabled={isSavingSettings}
                                    className={`px-8 py-3 text-sm font-black rounded-xl shadow-[0_4px_14px_0_rgba(225,29,72,0.39)] hover:shadow-[0_6px_20px_rgba(225,29,72,0.23)] hover:bg-rose-700 transition-all ${settingsSavedFeedback ? 'bg-green-600 shadow-[0_4px_14px_0_rgba(22,163,74,0.39)]' : 'bg-rose-600 text-white'}`}
                                >
                                    {isSavingSettings ? 'Enregistrement…' : settingsSavedFeedback ? '✅ Sauvegardé !' : '💾 Sauvegarder les Paramètres'}
                                </button>
                                <p className="text-[10px] text-stone-400 mt-3 max-w-lg text-center leading-relaxed">
                                    N'oublie pas de cliquer sur ce bouton quand tu as fini tes réglages. Le Cron Job prendra en compte ces nouvelles valeurs à sa prochaine exécution automatique.
                                </p>
                                
                                <div className="flex gap-2 border-t border-stone-100 mt-8 pt-6 w-full justify-center">
                                    <button
                                        onClick={testDiscordImages}
                                        disabled={isTriggering}
                                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors disabled:opacity-50"
                                    >
                                        🖼️ Tester Génération SmartCache
                                    </button>
                                    <button
                                        onClick={injectTestArticle}
                                        disabled={isTriggering}
                                        className="px-4 py-2 text-xs font-semibold rounded-lg border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 transition-colors disabled:opacity-50"
                                    >
                                        🧪 Injecter un article de test
                                    </button>
                                </div>
                            </div>
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── LOGS TERMINAL ──────────────────────────── */}
            <AnimatePresence>
                {triggerLogs !== null && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-stone-900 text-stone-300 text-xs font-mono overflow-hidden border-b border-stone-700"
                    >
                        <div className="max-w-5xl mx-auto px-6 py-3">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-stone-400 font-semibold">Journal du scan en direct</span>
                                <button onClick={() => setTriggerLogs(null)} className="text-stone-500 hover:text-stone-200 transition-colors">✕</button>
                            </div>
                            <pre className="whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">{triggerLogs}</pre>
                            {isTriggering && <div className="mt-2 text-rose-400 animate-pulse text-[10px]">Traitement en cours — ne quittez pas la page</div>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── PANNEAU RUBRIQUES ──────────────────────── */}
            <AnimatePresence>
                {showNavSection && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="bg-white border-b border-stone-200 shadow-sm">
                        <div className="max-w-5xl mx-auto px-6 py-5">
                            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-3">Rubriques du header — ON/OFF</p>
                            <p className="text-xs text-stone-400 mb-4">Les changements sont pris en compte dans les 60 secondes (cache CDN). L'invalidation du sessionStorage est immédiate sur ce navigateur.</p>
                            <div className="space-y-2">
                                {navItems.map(item => (
                                    <div key={item.slug} className="flex items-center justify-between py-2.5 px-4 rounded-xl border border-stone-100 bg-stone-50">
                                        <div>
                                            <span className="text-sm font-semibold text-stone-800">{item.label}</span>
                                            <span className="ml-2 text-xs text-stone-400 font-mono">{item.path}</span>
                                            {item.badge && <span className="ml-2 text-[10px] bg-rose-100 text-rose-600 font-black px-1.5 py-0.5 rounded">{item.badge}</span>}
                                        </div>
                                        <Toggle
                                            checked={item.enabled}
                                            disabled={navSaving === item.slug}
                                            onChange={(val) => toggleNavItem(item.slug, val)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── PANNEAU ÉLECTIONS ──────────────────────── */}
            <AnimatePresence>
                {showElectionsSection && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        className="bg-white border-b border-stone-200 shadow-sm">
                        <div className="max-w-5xl mx-auto px-6 py-5">
                            <div className="flex items-center justify-between mb-2">
                                <div>
                                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-0.5">Saisie Rapide des Résultats Électoraux</p>
                                    <p className="text-xs text-stone-400">La ville est conservée entre les saisies. Entrez les 5 candidats d'une ville en moins de 30 secondes.</p>
                                </div>
                                <button
                                    onClick={handleSyncOfficial}
                                    disabled={isSyncingOfficial}
                                    className="px-4 py-2 bg-stone-900 hover:bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all disabled:opacity-50 flex items-center gap-2 shadow-xl"
                                >
                                    {isSyncingOfficial ? (
                                        <>
                                            <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Sync en cours...
                                        </>
                                    ) : (
                                        <>🔄 Force Sync data.gouv.fr</>
                                    )}
                                </button>
                            </div>

                            {/* Barre de saisie rapide */}
                            <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-4">
                                {/* Ligne 1 : Ville + Tour */}
                                <div className="flex gap-2 mb-2">
                                    <div className="flex-1">
                                        <input
                                            list="villes-list"
                                            placeholder="Ville *"
                                            value={electionForm.ville}
                                            onChange={e => setElectionForm(f => ({ ...f, ville: e.target.value }))}
                                            className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400/30"
                                        />
                                        <datalist id="villes-list">
                                            {villesSaisies.map(v => <option key={v} value={v} />)}
                                        </datalist>
                                    </div>
                                    <div className="flex border border-stone-200 rounded-lg overflow-hidden text-xs font-black">
                                        {['1', '2'].map(t => (
                                            <button key={t}
                                                onClick={() => setElectionForm(f => ({ ...f, tour: t }))}
                                                className={`px-4 py-2 transition-colors ${electionForm.tour === t ? 'bg-rose-600 text-white' : 'bg-white text-stone-500 hover:bg-stone-50'}`}>
                                                Tour {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Ligne 2 : Candidat */}
                                <input
                                    placeholder="Nom Prénom du candidat *"
                                    value={electionForm.candidat}
                                    onChange={e => setElectionForm(f => ({ ...f, candidat: e.target.value }))}
                                    onKeyDown={e => e.key === 'Enter' && submitElectionResult()}
                                    className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
                                />

                                {/* Ligne 3 : Nuance + Statut + % + Voix */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                    <select value={electionForm.nuance} onChange={e => setElectionForm(f => ({ ...f, nuance: e.target.value }))}
                                        className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400/30">
                                        <option value="">Nuance…</option>
                                        {NUANCES.map(n => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <select value={electionForm.statut} onChange={e => setElectionForm(f => ({ ...f, statut: e.target.value }))}
                                        className="border border-stone-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400/30">
                                        {STATUTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                    <input type="number" placeholder="% *" min="0" max="100" step="0.01"
                                        value={electionForm.pct} onChange={e => setElectionForm(f => ({ ...f, pct: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && submitElectionResult()}
                                        className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30" />
                                    <input type="number" placeholder="Voix (opt.)"
                                        value={electionForm.voix} onChange={e => setElectionForm(f => ({ ...f, voix: e.target.value }))}
                                        onKeyDown={e => e.key === 'Enter' && submitElectionResult()}
                                        className="border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400/30" />
                                </div>

                                <div className="flex items-center gap-3">
                                    <button onClick={submitElectionResult}
                                        disabled={electionSaving || !electionForm.ville || !electionForm.candidat || !electionForm.pct}
                                        className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-lg transition-colors disabled:opacity-50">
                                        {electionSaving ? 'Enregistrement...' : '+ Ajouter / Mettre a jour'}
                                    </button>
                                    <p className="text-xs text-stone-400 shrink-0">Entree pour valider</p>
                                </div>
                                {electionMsg && (
                                    <p className="mt-2 text-xs text-green-600 font-semibold">OK: {electionMsg}</p>
                                )}
                            </div>

                            {/* Liste des résultats saisis */}
                            {electionResults.length === 0 ? (
                                <p className="text-xs text-stone-400 text-center py-4">Aucun résultat saisi. Commencez par le 1er Tour.</p>
                            ) : (
                                <div>
                                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-2">
                                        {electionResults.length} résultat{electionResults.length > 1 ? 's' : ''} saisis
                                    </p>
                                    <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden">
                                        {electionResults.map((o: any) => (
                                            <div key={o.id} className="flex items-center justify-between py-2 px-3 hover:bg-stone-50 transition-colors">
                                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                                    <span className="font-mono text-[10px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded">
                                                        {o.ville} T{o.tour}
                                                    </span>
                                                    <span className="font-semibold text-stone-800">{o.candidat}</span>
                                                    {o.nuance && <span className="text-stone-400">{o.nuance}</span>}
                                                    <span className="font-black text-rose-600">{o.pct}%</span>
                                                    {o.voix > 0 && <span className="text-stone-300">{o.voix.toLocaleString('fr-FR')} voix</span>}
                                                    <span className={`text-[9px] font-black px-1.5 py-0.5 uppercase ${
                                                        o.statut === 'elu' ? 'bg-green-100 text-green-700' :
                                                        o.statut === 'qualifie' ? 'bg-rose-100 text-rose-700' :
                                                        'bg-stone-100 text-stone-400'
                                                    }`}>{o.statut}</span>
                                                </div>
                                                <button onClick={() => deleteElectionResult(o.id)}
                                                    className="text-stone-300 hover:text-rose-500 transition-colors ml-2 shrink-0 text-sm">x</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* ── CONTENU PRINCIPAL ──────────────────────── */}
            <main className="max-w-5xl mx-auto px-6 py-8">

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                        ⚠️ Erreur base de données : {error}
                    </div>
                )}

                {/* Onglets + filtres */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <nav className="flex gap-1 p-1 bg-stone-100 rounded-xl">
                            {TABS.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                        ? 'bg-white text-stone-900 shadow-sm'
                                        : 'text-stone-500 hover:text-stone-700'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-stone-400">{posts.length} article{posts.length !== 1 ? 's' : ''}</span>
                            <button onClick={fetchQueue} className="text-sm text-rose-500 hover:text-rose-600 font-medium transition-colors">
                                Rafraîchir
                            </button>
                        </div>
                    </div>

                    {/* Filtres Géo (uniquement pour les posts) */}
                    {['PENDING', 'APPROVED', 'PUBLISHED', 'REJECTED', 'IGNORED'].includes(activeTab) && (
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex rounded-lg border border-stone-200 bg-white overflow-hidden text-xs font-semibold">
                                {([['france', '🇫🇷 France'], ['international', '🌍 International'], ['all', 'Tout']] as const).map(([key, label]) => (
                                    <button
                                        key={key}
                                        onClick={() => setGeoFilter(key)}
                                        className={`px-3 py-1.5 transition-colors border-r last:border-r-0 border-stone-200 ${geoFilter === key ? 'bg-stone-900 text-white' : 'text-stone-500 hover:bg-stone-50'
                                            }`}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                            {/* Tags trending */}
                            {trendingTags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {trendingTags.map(({ tag, count }) => (
                                        <button
                                            key={tag}
                                            onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${activeTag === tag
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                                }`}
                                        >
                                            #{tag} <span className="opacity-60">{count}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Liste des posts ou autres onglets */}
                <div className="space-y-4">
                    <AnimatePresence mode="wait">
                        {activeTab === 'CONSOLE' ? (
                            <motion.div key="console" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <ConsoleTab />
                            </motion.div>
                        ) : activeTab === 'STUDIO' ? (
                            <motion.div key="studio" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <StudioSocialTab />
                            </motion.div>
                        ) : activeTab === 'TEST_IA' ? (
                            <motion.div key="testia" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                <TestIATab />
                            </motion.div>
                        ) : (
                            <motion.div key="posts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                                {loading ? (
                                    <div className="text-center py-20 text-stone-400">Chargement…</div>
                                ) : posts.length === 0 ? (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-24">
                                        <div className="text-4xl mb-3">
                                            {activeTab === 'PENDING' ? '📭' : activeTab === 'PUBLISHED' ? '✅' : activeTab === 'APPROVED' ? '🕒' : '🗑️'}
                                        </div>
                                        <p className="text-stone-500 text-sm">
                                            {activeTab === 'PENDING' ? 'Aucune dépêche en attente de modération.' : `Aucun article dans cette catégorie.`}
                                        </p>
                                        {activeTab === 'PENDING' && (
                                            <button onClick={triggerGeneration} disabled={isTriggering} className="mt-4 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50">
                                                Lancer un scan IA maintenant
                                            </button>
                                        )}
                                    </motion.div>
                                ) : (
                                    <div className="space-y-4">
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
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            {/* Bulk Action Bar */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div 
                        initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
                        className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-800 p-4 shadow-2xl z-50 pointer-events-auto"
                    >
                        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-4 justify-between">
                            <div className="flex items-center gap-3 text-white">
                                <span className="flex items-center justify-center bg-rose-500 text-white font-bold w-6 h-6 rounded-full text-xs">
                                    {selectedIds.length}
                                </span>
                                <span className="font-semibold text-sm">articles sélectionnés</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button onClick={() => setSelectedIds([])} className="px-3 py-2 text-xs font-semibold text-stone-400 hover:text-white transition-colors">
                                    Désélectionner
                                </button>
                                <button onClick={() => setSelectedIds(posts.map(p => p.id))} className="px-3 py-2 text-xs font-semibold text-stone-300 hover:text-white transition-colors border-l border-stone-700 pl-3">
                                    Tout sélectionner
                                </button>
                                {activeTab !== 'APPROVED' && (
                                    <button onClick={() => handleBulkStatus('APPROVED')} className="px-3 py-2 text-xs font-semibold rounded-lg bg-stone-800 text-amber-500 hover:bg-stone-700 transition-colors shadow-sm">
                                        👍 Approuver
                                    </button>
                                )}
                                {activeTab !== 'REJECTED' && (
                                    <button onClick={() => handleBulkStatus('REJECTED')} className="px-3 py-2 text-xs font-semibold rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 transition-colors shadow-sm">
                                        👎 Rejeter
                                    </button>
                                )}
                                {activeTab === 'IGNORED' && (
                                    <button onClick={() => handleBulkStatus('PENDING')} className="px-3 py-2 text-xs font-semibold rounded-lg bg-stone-800 text-stone-300 hover:bg-stone-700 transition-colors shadow-sm">
                                        📥 Restaurer vers modération
                                    </button>
                                )}
                                {activeTab !== 'IGNORED' && (
                                    <button onClick={() => handleBulkStatus('IGNORED')} className="px-3 py-2 text-xs font-semibold rounded-lg bg-stone-800 text-stone-400 hover:bg-stone-700 transition-colors shadow-sm">
                                        📦 Mettre en Annexe
                                    </button>
                                )}
                                <button onClick={() => handleBulkStatus('PUBLISHED')} className="px-3 py-2 text-xs font-bold rounded-lg bg-rose-600 text-white hover:bg-rose-500 transition-colors shadow-sm flex items-center gap-2">
                                    🚀 Diffuser !
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ─── CARTE D'ARTICLE ──────────────────────────────────────────
function RadarCard({ post, onUpdate, activeTab, isSelected, onToggleSelect }: {
    post: RadarPost;
    onUpdate: (id: number, status: 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'IGNORED' | 'PENDING', content?: string, imageUrl?: string, title?: string) => void;
    activeTab: string;
    isSelected?: boolean;
    onToggleSelect?: (id: number, selected: boolean) => void;
}) {
    const [title, setTitle] = useState(post.source_title);
    const [content, setContent] = useState(post.flash_content);
    const [imageUrl, setImageUrl] = useState(post.image_keyword || '');
    const [isSaving, setIsSaving] = useState(false);
    const [expanded, setExpanded] = useState(true);

    const handleAction = async (status: 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'IGNORED' | 'PENDING') => {
        setIsSaving(true);
        await onUpdate(post.id, status, content, imageUrl, title);
        setIsSaving(false);
    };

    const isPending = activeTab === 'PENDING';
    const isIgnored = activeTab === 'IGNORED';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
            {/* Card Header */}
            <div className="px-5 py-3.5 flex items-center gap-3 border-b border-stone-100">
                {onToggleSelect && (
                    <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => onToggleSelect(post.id, e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                )}
                <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                    Flash IA
                </span>
                <div className="flex-1 min-w-0">
                    {isPending ? (
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full text-sm font-semibold text-stone-800 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-stone-400"
                            placeholder="Titre de la source…"
                        />
                    ) : (
                        <span className="text-sm font-semibold text-stone-700 truncate block">{title}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <time className="text-xs text-stone-400">{new Date(post.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                    <a href={post.source_url} target="_blank" rel="noreferrer" className="text-xs text-sky-500 hover:text-sky-600 font-medium transition-colors">
                        Source ↗
                    </a>
                    <button onClick={() => setExpanded(e => !e)} className="text-stone-400 hover:text-stone-600 transition-colors text-sm">
                        {expanded ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {/* Card Body */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 py-4">
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                disabled={!isPending}
                                rows={6}
                                className={`w-full text-sm leading-relaxed text-stone-700 rounded-xl border resize-y focus:outline-none transition-colors p-3.5 ${isPending
                                    ? 'border-stone-200 hover:border-stone-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 bg-stone-50'
                                    : 'border-transparent bg-transparent opacity-80 cursor-default'
                                    }`}
                            />

                            {/* Image */}
                            {isPending && (
                                <div className="mt-3">
                                    <label className="text-xs font-medium text-stone-500 block mb-1.5">Image attachée (URL)</label>
                                    <input
                                        type="text"
                                        value={imageUrl}
                                        onChange={e => setImageUrl(e.target.value)}
                                        placeholder="https://… (laisser vide si aucune)"
                                        className="w-full text-sm border border-stone-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-colors placeholder:text-stone-300"
                                    />
                                    {imageUrl && imageUrl.startsWith('http') && (
                                        <img src={imageUrl} alt="Preview" className="mt-2 w-32 h-20 object-cover rounded-lg border border-stone-200" />
                                    )}
                                </div>
                            )}
                            {!isPending && imageUrl && imageUrl.startsWith('http') && (
                                <img src={imageUrl} alt="Image" className="mt-2 w-32 h-20 object-cover rounded-lg border border-stone-200 opacity-80" />
                            )}
                        </div>

                        {/* Tags */}
                        {(post as any).tags && (post as any).tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {((post as any).tags as string).split(',').filter(Boolean).map((t: string) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-medium border border-stone-200">
                                        #{t.trim()}
                                    </span>
                                ))}
                                {(post as any).geo && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${(post as any).geo === 'france'
                                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                        }`}>
                                        {(post as any).geo === 'france' ? '🇫🇷 France' : '🌍 International'}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className={`px-5 py-3.5 flex items-center justify-between border-t border-stone-100 ${isPending ? 'bg-stone-50' : 'bg-transparent'}`}>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                activeTab === 'PUBLISHED' ? 'text-green-600 bg-green-50 border border-green-100' : 
                                activeTab === 'APPROVED' ? 'text-amber-600 bg-amber-50 border border-amber-100' : 
                                activeTab === 'REJECTED' ? 'text-stone-400 bg-stone-100' : 
                                activeTab === 'IGNORED' ? 'text-stone-500 bg-stone-100 border border-stone-200' : ''
                            }`}>
                                {activeTab === 'PUBLISHED' ? '✓ Publié' : activeTab === 'APPROVED' ? '🕒 En file' : activeTab === 'REJECTED' ? 'Rejeté' : activeTab === 'IGNORED' ? '📦 Archive (Annexe)' : ''}
                            </span>

                            {isPending && (
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex items-center gap-1">
                                        <button
                                            onClick={() => window.open(`/radar-admin/studio?id=${post.id}`, '_blank')}
                                            disabled={isSaving}
                                            className="px-3 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                                        >
                                            📸 Studio Insta
                                        </button>
                                        <TooltipInfo text="Ouvre ce flash dans un studio dédié pour générer automatiquement une image et une caption optimisés au format Instagram." position="top" />
                                    </div>
                                    <div className="relative flex items-center gap-1 ml-1.5">
                                        <button
                                            onClick={() => handleAction('REJECTED')}
                                            disabled={isSaving}
                                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-stone-700 hover:border-stone-300 transition-colors disabled:opacity-50"
                                        >
                                            Rejeter
                                        </button>
                                        <TooltipInfo text="Jette cet article définitivement. Il ne sera pas publié et ne sera plus reproposé." position="top" />
                                    </div>
                                    <div className="relative flex items-center gap-1 ml-1.5">
                                        <button
                                            onClick={() => handleAction('APPROVED')}
                                            disabled={isSaving}
                                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                        >
                                            🕒 File d'attente
                                        </button>
                                        <TooltipInfo text="Valide cet article. Il partira en file d'attente et sera publié de manière invisible par le Pilote Auto avec un décalage aléatoire (pour passer l'anti-bot)." position="top" />
                                    </div>
                                    <div className="relative flex items-center gap-1 ml-1.5">
                                        <button
                                            onClick={() => handleAction('PUBLISHED')}
                                            disabled={isSaving}
                                            className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm hover:shadow-rose-200 disabled:opacity-50"
                                        >
                                            {isSaving ? 'Envoi…' : '⚡ Publier'}
                                        </button>
                                        <TooltipInfo text="Publie IMMÉDIATEMENT cet article sur WordPress. Ignore le délai de publication aléatoire." position="top" />
                                    </div>

                                    <div className="relative flex items-center gap-1 ml-3 px-3 border-l border-stone-200">
                                        <button
                                            onClick={() => handleAction('IGNORED')}
                                            disabled={isSaving}
                                            className="p-2 text-stone-400 hover:text-stone-700 transition-colors"
                                        >
                                            📦
                                        </button>
                                        <TooltipInfo text="Mettre en Annexe (Archiver)" position="top" />
                                    </div>
                                </div>
                            )}

                            {isIgnored && (
                                <button
                                    onClick={() => handleAction('PENDING')}
                                    disabled={isSaving}
                                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
                                >
                                    📥 Restaurer vers "À modérer"
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
