'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { DashboardLayout } from '../components/DashboardLayout';

const MODEL_OPTIONS = [
    'gemini-3.1-pro-preview',
    'gemini-3.1-flash-lite-preview',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro'
];

function parseJsonObject(raw: any, fallback: any = {}) {
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(String(raw));
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
}

function parseJsonArray(raw: any, fallback: string[] = []) {
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(String(raw));
        return Array.isArray(parsed) ? parsed.map((x) => String(x)).filter(Boolean) : fallback;
    } catch (_) {
        return fallback;
    }
}

const DEFAULT_SOURCE_CFG = {
    enabled: true,
    source_type: 'dataset-api',
    parser_strategy: 'municipales-communes-v1',
    source_url: '',
    dataset_first_tour: '',
    dataset_second_tour: '',
    candidate_first_tour: '',
    candidate_second_tour: '',
    results_first_tour_url: '',
    results_second_tour_url: '',
    candidatures_first_tour_url: '',
    candidatures_second_tour_url: ''
};

const DEFAULT_DAEMON_CFG = {
    enabled: false,
    live_mode_enabled: false,
    poll_interval_minutes: 2,
    interval_enabled: true,
    interval_hours: 0.5,
    schedule_enabled: false,
    schedule_times: '',
    sync_locked: false
};

export default function SettingsPage() {
    const [isOverlayMode, setIsOverlayMode] = useState(false);
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();
    const [activeTab, setActiveTab] = useState<'sources' | 'users' | 'elections' | 'pipeline' | 'diffusion' | 'health' | 'comms'>('sources');
    const [advancedMode, setAdvancedMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isTestingImages, setIsTestingImages] = useState(false);
    const [form, setForm] = useState<any>({});
    const [newElectionSlug, setNewElectionSlug] = useState('');
    const [wizardOpen, setWizardOpen] = useState(false);
    const [wizardSlug, setWizardSlug] = useState('');
    const [wizardShowFront, setWizardShowFront] = useState(true);
    const [wizardUseAsTarget, setWizardUseAsTarget] = useState(false);
    const [wizardLiveEnabled, setWizardLiveEnabled] = useState(false);
    const [wizardPollMin, setWizardPollMin] = useState(2);
    const [wizardUseRawUrls, setWizardUseRawUrls] = useState(false);
    const [wizardSourceUrl, setWizardSourceUrl] = useState('');
    const [wizardDatasetFirst, setWizardDatasetFirst] = useState('');
    const [wizardDatasetSecond, setWizardDatasetSecond] = useState('');
    const [wizardCandidateFirst, setWizardCandidateFirst] = useState('');
    const [wizardCandidateSecond, setWizardCandidateSecond] = useState('');

    const [users, setUsers] = useState<Array<{
        id: number;
        username: string;
        role: 'admin' | 'editor' | 'viewer';
        is_active: number;
        permissions: Record<string, boolean>;
        created_at: string;
    }>>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersSaving, setUsersSaving] = useState(false);
    const [userForm, setUserForm] = useState({
        username: '',
        password: '',
        role: 'viewer' as 'admin' | 'editor' | 'viewer',
        permissions: {
            radar: true,
            studio: false,
            network: false,
            lab: false,
            daemon: false,
            settings: false,
            users: false
        },
        is_active: true
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const params = new URLSearchParams(window.location.search);
        setIsOverlayMode(params.get('overlay') === '1');

        const tab = params.get('tab');
        if (tab && ['sources', 'users', 'elections', 'pipeline', 'diffusion', 'health', 'comms'].includes(tab)) {
            setActiveTab(tab as 'sources' | 'users' | 'elections' | 'pipeline' | 'diffusion' | 'health' | 'comms');
        }
    }, []);

    const notifyParentStatus = (status: 'clean' | 'dirty' | 'saving' | 'saved') => {
        if (!isOverlayMode || typeof window === 'undefined') return;
        window.parent.postMessage(
            {
                type: 'radar-settings-status',
                status
            },
            window.location.origin
        );
    };

    useEffect(() => {
        if (settings) {
            setForm({ ...settings });
            setIsDirty(false);
            notifyParentStatus('clean');
        }
    }, [settings]);

    const handleSave = async () => {
        setIsSaving(true);
        notifyParentStatus('saving');
        try {
            await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            fetchSettings();
            setIsDirty(false);
            notifyParentStatus('saved');
        } catch (e) { console.error(e); }
        finally { setIsSaving(false); }
    };

    const updateForm = (key: string, val: any) => {
        setForm((prev: any) => ({ ...prev, [key]: val }));
        setIsDirty(true);
        notifyParentStatus('dirty');
    };

    const electionSourcesMap = useMemo(() => parseJsonObject(form.election_sources_json, {}), [form.election_sources_json]);
    const electionDaemonMap = useMemo(() => parseJsonObject(form.election_daemon_by_slug_json, {}), [form.election_daemon_by_slug_json]);
    const displaySlugs = useMemo(() => parseJsonArray(form.election_front_display_slugs_json, ['municipales-2026']), [form.election_front_display_slugs_json]);
    const lastUsedSourcesMap = useMemo(() => parseJsonObject(form.election_last_used_source_json, {}), [form.election_last_used_source_json]);

    const electionSlugs = useMemo(() => {
        const slugs = new Set<string>();
        for (const key of Object.keys(electionSourcesMap || {})) slugs.add(String(key));
        for (const key of Object.keys(electionDaemonMap || {})) slugs.add(String(key));
        for (const key of displaySlugs || []) slugs.add(String(key));
        if (form.election_analysis_target_slug) slugs.add(String(form.election_analysis_target_slug));
        if (!slugs.size) slugs.add('municipales-2026');
        return Array.from(slugs).sort((a, b) => a.localeCompare(b));
    }, [electionSourcesMap, electionDaemonMap, displaySlugs, form.election_analysis_target_slug]);

    const updateElectionSourcesMap = (next: Record<string, any>) => {
        updateForm('election_sources_json', JSON.stringify(next, null, 2));
    };

    const updateElectionDaemonMap = (next: Record<string, any>) => {
        updateForm('election_daemon_by_slug_json', JSON.stringify(next, null, 2));
    };

    const updateDisplaySlugs = (next: string[]) => {
        updateForm('election_front_display_slugs_json', JSON.stringify(next));
    };

    const ensureSlugConfigs = (slug: string) => {
        const cleanSlug = slug.trim();
        if (!cleanSlug) return;
        const nextSources = { ...electionSourcesMap };
        const nextDaemon = { ...electionDaemonMap };
        if (!nextSources[cleanSlug]) nextSources[cleanSlug] = { ...DEFAULT_SOURCE_CFG };
        if (!nextDaemon[cleanSlug]) nextDaemon[cleanSlug] = { ...DEFAULT_DAEMON_CFG };
        updateElectionSourcesMap(nextSources);
        updateElectionDaemonMap(nextDaemon);
    };

    const addElectionSlug = () => {
        const slug = newElectionSlug.trim().toLowerCase();
        if (!slug) return;
        if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
            alert('Slug invalide. Utilise uniquement lettres/chiffres/tirets (3-80).');
            return;
        }
        ensureSlugConfigs(slug);
        if (!displaySlugs.includes(slug)) updateDisplaySlugs([...displaySlugs, slug]);
        if (!form.election_analysis_target_slug) updateForm('election_analysis_target_slug', slug);
        setNewElectionSlug('');
    };

    const removeElectionSlug = (slug: string) => {
        if (slug === 'municipales-2026') {
            alert('Le slug municipale de base est conservé pour la compatibilité.');
            return;
        }
        if (!confirm(`Supprimer la configuration du slug ${slug} ?`)) return;
        const nextSources = { ...electionSourcesMap };
        const nextDaemon = { ...electionDaemonMap };
        delete nextSources[slug];
        delete nextDaemon[slug];
        updateElectionSourcesMap(nextSources);
        updateElectionDaemonMap(nextDaemon);
        updateDisplaySlugs(displaySlugs.filter((x) => x !== slug));
        if (form.election_analysis_target_slug === slug) {
            updateForm('election_analysis_target_slug', 'municipales-2026');
        }
    };

    const toggleSlugDisplay = (slug: string, checked: boolean) => {
        if (checked) {
            if (!displaySlugs.includes(slug)) updateDisplaySlugs([...displaySlugs, slug]);
        } else {
            updateDisplaySlugs(displaySlugs.filter((x) => x !== slug));
        }
    };

    const moveDisplaySlug = (slug: string, dir: -1 | 1) => {
        const idx = displaySlugs.indexOf(slug);
        if (idx < 0) return;
        const target = idx + dir;
        if (target < 0 || target >= displaySlugs.length) return;
        const next = [...displaySlugs];
        [next[idx], next[target]] = [next[target], next[idx]];
        updateDisplaySlugs(next);
    };

    const updateSourceCfg = (slug: string, key: string, value: any) => {
        const next = { ...electionSourcesMap };
        const base = next[slug] && typeof next[slug] === 'object' ? next[slug] : { ...DEFAULT_SOURCE_CFG };
        next[slug] = { ...base, [key]: value };
        updateElectionSourcesMap(next);
    };

    const updateDaemonCfg = (slug: string, key: string, value: any) => {
        const next = { ...electionDaemonMap };
        const base = next[slug] && typeof next[slug] === 'object' ? next[slug] : { ...DEFAULT_DAEMON_CFG };
        next[slug] = { ...base, [key]: value };
        updateElectionDaemonMap(next);
    };

    const openWizard = () => {
        setWizardSlug('');
        setWizardShowFront(true);
        setWizardUseAsTarget(false);
        setWizardLiveEnabled(false);
        setWizardPollMin(2);
        setWizardUseRawUrls(false);
        setWizardSourceUrl('');
        setWizardDatasetFirst('');
        setWizardDatasetSecond('');
        setWizardCandidateFirst('');
        setWizardCandidateSecond('');
        setWizardOpen(true);
    };

    const applyWizard = () => {
        const slug = wizardSlug.trim().toLowerCase();
        if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
            alert('Slug invalide. Utilise uniquement lettres/chiffres/tirets (3-80).');
            return;
        }

        const nextSources = { ...electionSourcesMap };
        const nextDaemon = { ...electionDaemonMap };
        const sourceBase = nextSources[slug] && typeof nextSources[slug] === 'object'
            ? nextSources[slug]
            : { ...DEFAULT_SOURCE_CFG };
        const daemonBase = nextDaemon[slug] && typeof nextDaemon[slug] === 'object'
            ? nextDaemon[slug]
            : { ...DEFAULT_DAEMON_CFG };

        nextSources[slug] = {
            ...sourceBase,
            enabled: true,
            source_url: wizardUseRawUrls ? wizardSourceUrl.trim() : '',
            dataset_first_tour: wizardUseRawUrls ? '' : wizardDatasetFirst.trim(),
            dataset_second_tour: wizardUseRawUrls ? '' : wizardDatasetSecond.trim(),
            candidate_first_tour: wizardUseRawUrls ? '' : wizardCandidateFirst.trim(),
            candidate_second_tour: wizardUseRawUrls ? '' : wizardCandidateSecond.trim()
        };

        nextDaemon[slug] = {
            ...daemonBase,
            enabled: true,
            live_mode_enabled: wizardLiveEnabled,
            poll_interval_minutes: Math.max(2, Number(wizardPollMin || 2))
        };

        updateElectionSourcesMap(nextSources);
        updateElectionDaemonMap(nextDaemon);

        if (wizardShowFront && !displaySlugs.includes(slug)) {
            updateDisplaySlugs([...displaySlugs, slug]);
        }
        if (!wizardShowFront && displaySlugs.includes(slug)) {
            updateDisplaySlugs(displaySlugs.filter((x) => x !== slug));
        }
        if (wizardUseAsTarget || !form.election_analysis_target_slug) {
            updateForm('election_analysis_target_slug', slug);
        }

        setWizardOpen(false);
    };

    const handleTestFlows = async () => {
        setIsTesting(true);
        try {
            const res = await fetch('/api/radar/test-flows', { method: 'POST' });
            const data = await res.json();
            if (data.success) alert(data.message);
        } catch (e) { console.error(e); }
        finally { setIsTesting(false); }
    };

    const handleTestImages = async () => {
        setIsTestingImages(true);
        try {
            const res = await fetch('/api/radar/test-images', { method: 'POST' });
            const data = await res.json();
            if (data.success) alert('Test images lance. Verifie Discord pour les rendus 1:1 et 16:9.');
            else alert(data.error || 'Echec du test image.');
        } catch (e) {
            console.error(e);
            alert('Erreur reseau pendant le test image.');
        } finally {
            setIsTestingImages(false);
        }
    };

    const fetchUsers = async () => {
        setUsersLoading(true);
        try {
            const res = await fetch('/api/radar/users');
            const data = await res.json();
            if (data.success) setUsers(data.users || []);
        } catch (e) {
            console.error(e);
        } finally {
            setUsersLoading(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'users') {
            fetchUsers();
        }
    }, [activeTab]);

    const patchUserFormPermission = (key: string, value: boolean) => {
        if (userForm.role === 'admin') return;
        setUserForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: value } }));
    };

    const onUserRoleChange = (role: 'admin' | 'editor' | 'viewer') => {
        if (role === 'admin') {
            setUserForm(prev => ({
                ...prev,
                role,
                permissions: {
                    radar: true,
                    studio: true,
                    network: true,
                    lab: true,
                    daemon: true,
                    settings: true,
                    users: true
                }
            }));
            return;
        }
        setUserForm(prev => ({ ...prev, role }));
    };

    const createUser = async () => {
        setUsersSaving(true);
        try {
            const res = await fetch('/api/radar/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userForm)
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Creation impossible.');
            } else {
                setUserForm({
                    username: '',
                    password: '',
                    role: 'viewer',
                    permissions: {
                        radar: true,
                        studio: false,
                        network: false,
                        lab: false,
                        daemon: false,
                        settings: false,
                        users: false
                    },
                    is_active: true
                });
                await fetchUsers();
            }
        } catch (e) {
            console.error(e);
            alert('Erreur reseau creation utilisateur.');
        } finally {
            setUsersSaving(false);
        }
    };

    const updateUser = async (id: number, patch: any) => {
        try {
            const res = await fetch('/api/radar/users', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...patch })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Mise a jour impossible.');
                return;
            }
            await fetchUsers();
        } catch (e) {
            console.error(e);
            alert('Erreur reseau mise a jour utilisateur.');
        }
    };

    const deleteUser = async (id: number) => {
        if (!confirm('Supprimer cet utilisateur ?')) return;
        try {
            const res = await fetch('/api/radar/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Suppression impossible.');
                return;
            }
            await fetchUsers();
        } catch (e) {
            console.error(e);
            alert('Erreur reseau suppression utilisateur.');
        }
    };

    const tabs = [
        { key: 'sources', label: 'Sources', icon: 'rss_feed', advanced: false },
        { key: 'users', label: 'Users', icon: 'manage_accounts', advanced: false },
        { key: 'elections', label: 'Élections', icon: 'how_to_vote', advanced: false },
        { key: 'pipeline', label: 'Pipeline', icon: 'tune', advanced: true },
        { key: 'diffusion', label: 'Diffusion', icon: 'share', advanced: true },
        { key: 'health', label: 'Maintenance', icon: 'health_and_safety', advanced: true },
        { key: 'comms', label: 'Comms', icon: 'campaign', advanced: true },
    ];
    const visibleTabs = tabs.filter(t => !t.advanced || advancedMode);

    useEffect(() => {
        if (!advancedMode && ['pipeline', 'diffusion', 'health', 'comms'].includes(activeTab)) {
            setActiveTab('sources');
        }
    }, [advancedMode, activeTab]);

    return (
        <DashboardLayout 
            title="CORTEX SETTINGS" 
            subtitle={countdown || "Configuration système active..."} 
            isDaemonRunning={isDaemonRunning}
            embedded={isOverlayMode}
        >
            <div className="max-w-6xl mx-auto font-label">
                <header className="mb-8 md:mb-12">
                    <h2 className="text-3xl font-black uppercase tracking-tighter font-headline mb-2">Paramètres Cortex</h2>
                    <p className="text-xs font-bold text-stone-500 uppercase tracking-widest">Configuration globale des moteurs OSINT et diffusion</p>
                    <div className="mt-4 inline-flex items-center gap-3 bg-white border-4 border-stone-900 px-4 py-2">
                        <span className="text-[10px] font-black uppercase tracking-widest">Mode avancé</span>
                        <Toggle checked={advancedMode} onChange={setAdvancedMode} />
                    </div>
                </header>

                <div className="flex flex-col md:flex-row gap-6 md:gap-12">
                    {/* Internal Nav */}
                    <nav className="w-full md:w-64 flex flex-col gap-4">
                        {visibleTabs.map(tab => (
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
                    <div className="flex-1 bg-white border-4 border-stone-900 shadow-[12px_12px_0px_0px_#1A1C1C] p-4 md:p-10 min-h-[600px]">
                        

                        

                        {activeTab === 'sources' && (
                            <div className="space-y-8">
                                <h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-6">Gestion des Sources</h3>
                                
                                <section className="space-y-4 border-l-4 border-stone-900 pl-4">
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-tight">Flux RSS</h4>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Un flux par ligne</p>
                                    </div>
                                    <textarea 
                                        value={(() => {
                                            try { return JSON.parse(form.rss_feeds || '[]').join('\n'); } catch { return ''; }
                                        })()}
                                        onChange={e => {
                                            const arr = e.target.value.split('\n').map(l => l.trim()).filter(Boolean);
                                            updateForm('rss_feeds', JSON.stringify(arr));
                                        }}
                                        rows={5}
                                        placeholder="https://exemple.com/rss"
                                        className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-xs"
                                    />
                                </section>

                                <section className="space-y-4 border-l-4 border-blue-600 pl-4">
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-tight">Telegram (Scraper)</h4>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Noms de chaînes, un par ligne (sans le @)</p>
                                    </div>
                                    <textarea 
                                        value={(() => {
                                            try { return JSON.parse(form.telegram_channels || '[]').join('\n'); } catch { return ''; }
                                        })()}
                                        onChange={e => {
                                            const arr = e.target.value.split('\n').map(l => l.trim().replace(/^@/, '')).filter(Boolean);
                                            updateForm('telegram_channels', JSON.stringify(arr));
                                        }}
                                        rows={5}
                                        placeholder="FranceInsoumise"
                                        className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-xs"
                                    />
                                </section>

                                <section className="space-y-4 border-l-4 border-neutral-800 pl-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="text-sm font-black uppercase tracking-tight">X / Twitter (RSS-Bridge)</h4>
                                            <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Comptes, un par ligne (sans le @)</p>
                                        </div>
                                    </div>
                                    <div className="mb-2">
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">URL de votre RSS-Bridge</label>
                                        <input 
                                            type="text" 
                                            value={form.rss_bridge_base_url || ''} 
                                            onChange={e => updateForm('rss_bridge_base_url', e.target.value)}
                                            placeholder="http://localhost:3300"
                                            className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs"
                                        />
                                    </div>
                                    <textarea 
                                        value={(() => {
                                            try { return JSON.parse(form.x_accounts || '[]').join('\n'); } catch { return ''; }
                                        })()}
                                        onChange={e => {
                                            const arr = e.target.value.split('\n').map(l => l.trim().replace(/^@/, '')).filter(Boolean);
                                            updateForm('x_accounts', JSON.stringify(arr));
                                        }}
                                        rows={5}
                                        placeholder="JLMelenchon"
                                        className="w-full bg-stone-50 border-4 border-stone-900 p-4 font-mono text-xs"
                                    />
                                </section>
                            </div>
                        )}

                        {activeTab === 'users' && (
                            <div className="space-y-8">
                                <h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-6">Users</h3>

                                <section className="bg-stone-50 border-4 border-stone-900 p-6 space-y-5">
                                    <h4 className="text-sm font-black uppercase tracking-tight">Nouvel utilisateur</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Username</label>
                                            <input value={userForm.username} onChange={e => setUserForm(prev => ({ ...prev, username: e.target.value }))} className="w-full bg-white border-4 border-stone-900 p-3 font-mono text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Password</label>
                                            <input type="password" value={userForm.password} onChange={e => setUserForm(prev => ({ ...prev, password: e.target.value }))} className="w-full bg-white border-4 border-stone-900 p-3 font-mono text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Role</label>
                                            <select value={userForm.role} onChange={e => onUserRoleChange(e.target.value as 'admin' | 'editor' | 'viewer')} className="w-full bg-white border-4 border-stone-900 p-3 font-black text-xs uppercase">
                                                <option value="admin">admin</option>
                                                <option value="editor">editor</option>
                                                <option value="viewer">viewer</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        {['radar', 'studio', 'network', 'lab', 'daemon', 'settings', 'users'].map(key => (
                                            <label key={key} className="flex items-center justify-between bg-white border-2 border-stone-900 p-2">
                                                <span className="text-[10px] font-black uppercase">{key}</span>
                                                <input type="checkbox" checked={Boolean((userForm.permissions as any)[key])} disabled={userForm.role === 'admin'} onChange={e => patchUserFormPermission(key, e.target.checked)} />
                                            </label>
                                        ))}
                                    </div>

                                    <button onClick={createUser} disabled={usersSaving} className="bg-red-700 text-white px-5 py-3 border-4 border-stone-900 text-xs font-black uppercase tracking-widest disabled:opacity-60">
                                        {usersSaving ? 'Creation...' : 'Creer le compte'}
                                    </button>
                                </section>

                                <section className="bg-white border-4 border-stone-900 p-6">
                                    <h4 className="text-sm font-black uppercase tracking-tight mb-4">Comptes existants</h4>
                                    {usersLoading ? (
                                        <div className="text-xs font-black uppercase tracking-widest text-stone-500">Chargement...</div>
                                    ) : users.length === 0 ? (
                                        <div className="text-xs font-black uppercase tracking-widest text-stone-500">Aucun compte utilisateur en base.</div>
                                    ) : (
                                        <div className="space-y-4">
                                            {users.map(user => (
                                                <div key={user.id} className="border-4 border-stone-900 p-4 bg-stone-50">
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                        <div>
                                                            <div className="text-sm font-black uppercase tracking-tight">{user.username}</div>
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Role: {user.role}</div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
                                                                Actif
                                                                <input type="checkbox" checked={user.is_active === 1} onChange={e => updateUser(user.id, { is_active: e.target.checked })} />
                                                            </label>
                                                            <button onClick={() => {
                                                                const pwd = prompt(`Nouveau mot de passe pour ${user.username} (10+ caracteres)`);
                                                                if (!pwd) return;
                                                                updateUser(user.id, { password: pwd });
                                                            }} className="px-3 py-2 bg-white border-2 border-stone-900 text-[10px] font-black uppercase">Reset pass</button>
                                                            <button onClick={() => deleteUser(user.id)} className="px-3 py-2 bg-red-700 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Supprimer</button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                                                        {['radar', 'studio', 'network', 'lab', 'daemon', 'settings', 'users'].map(key => (
                                                            <label key={key} className="flex items-center justify-between bg-white border-2 border-stone-900 p-2">
                                                                <span className="text-[10px] font-black uppercase">{key}</span>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={Boolean((user.permissions || {})[key]) || user.role === 'admin'}
                                                                    disabled={user.role === 'admin'}
                                                                    onChange={e => updateUser(user.id, { permissions: { ...(user.permissions || {}), [key]: e.target.checked } })}
                                                                />
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}
                        
                        {activeTab === 'elections' && (
                            <div className="space-y-8">
                                <h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-6">Élections</h3>

                                <section className="space-y-6">
                                    <h4 className="text-sm font-black uppercase tracking-tight">Daemon Global Élections</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-4 bg-stone-50 border-4 border-stone-900">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Activation globale du Daemon Élections</span>
                                            <Toggle checked={form.daemon_elections_enabled !== 'false'} onChange={v => updateForm('daemon_elections_enabled', v ? 'true' : 'false')} />
                                        </div>
                                        
                                    </div>

                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/radar/election-sync-manual', { method: 'POST' });
                                                const text = await res.text();
                                                alert('Result: ' + text);
                                            } catch (e) {
                                                alert('Error: ' + String(e));
                                            }
                                        }}
                                        className="bg-red-700 text-white px-4 py-3 border-4 border-stone-900 text-xs font-black uppercase tracking-widest hover:bg-stone-900 transition-colors"
                                    >
                                        LANCER SCAN ELECTION (MANUEL)
                                    </button>
                                </section>

<section className="space-y-4 border-l-4 border-red-700 pl-4">
                                    <div>
                                        <h4 className="text-sm font-black uppercase tracking-tight">Elections long-terme (multi-slugs)</h4>
                                        <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Ajoute des slugs, configure les sources Etat, active le daemon live par slug, et pilote show/hide front sans JSON manuel.</p>
                                    </div>

                                    <div className="bg-amber-50 border-4 border-stone-900 p-4 space-y-3">
                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                            <div>
                                                <div className="text-xs font-black uppercase tracking-widest">Assistant rapide (3 etapes)</div>
                                                <div className="text-[10px] font-bold uppercase text-stone-500">Slug, affichage, source + live daemon en moins d'une minute.</div>
                                            </div>
                                            <button onClick={openWizard} className="px-4 py-2 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest">Nouveau cycle guide</button>
                                        </div>

                                        {wizardOpen && (
                                            <div className="bg-white border-2 border-stone-900 p-4 space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[10px] font-black uppercase tracking-widest">
                                                    <div className="p-2 border-2 border-stone-900 bg-stone-100">1. Identite du slug</div>
                                                    <div className="p-2 border-2 border-stone-900 bg-stone-100">2. Visibilite front + cible daemon</div>
                                                    <div className="p-2 border-2 border-stone-900 bg-stone-100">3. Source Etat + mode live</div>
                                                </div>

                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase text-stone-500 block">Slug election</label>
                                                    <input type="text" value={wizardSlug} onChange={e => setWizardSlug(e.target.value)} placeholder="presidentielles-2027" className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-mono text-xs" />
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                                        <span className="text-[10px] font-black uppercase">Afficher ce slug en front</span>
                                                        <Toggle checked={wizardShowFront} onChange={setWizardShowFront} />
                                                    </div>
                                                    <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                                        <span className="text-[10px] font-black uppercase">Utiliser comme cible daemon</span>
                                                        <Toggle checked={wizardUseAsTarget} onChange={setWizardUseAsTarget} />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                                        <span className="text-[10px] font-black uppercase">Source URL directe</span>
                                                        <Toggle checked={wizardUseRawUrls} onChange={setWizardUseRawUrls} />
                                                    </div>
                                                    
                                                </div>

                                                

                                                {wizardUseRawUrls ? (
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">URL fichier Etat</label>
                                                        <input type="text" value={wizardSourceUrl} onChange={e => setWizardSourceUrl(e.target.value)} placeholder="https://..." className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-mono text-xs" />
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        <input type="text" value={wizardDatasetFirst} onChange={e => setWizardDatasetFirst(e.target.value)} placeholder="dataset premier tour" className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-mono text-xs" />
                                                        <input type="text" value={wizardDatasetSecond} onChange={e => setWizardDatasetSecond(e.target.value)} placeholder="dataset second tour" className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-mono text-xs" />
                                                        <input type="text" value={wizardCandidateFirst} onChange={e => setWizardCandidateFirst(e.target.value)} placeholder="dataset candidats tour 1" className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-mono text-xs" />
                                                        <input type="text" value={wizardCandidateSecond} onChange={e => setWizardCandidateSecond(e.target.value)} placeholder="dataset candidats tour 2" className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-mono text-xs" />
                                                    </div>
                                                )}

                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setWizardOpen(false)} className="px-3 py-2 border-2 border-stone-900 bg-white text-[10px] font-black uppercase">Annuler</button>
                                                    <button onClick={applyWizard} className="px-3 py-2 border-2 border-stone-900 bg-red-700 text-white text-[10px] font-black uppercase">Creer et configurer</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                                        <input
                                            type="text"
                                            value={newElectionSlug}
                                            onChange={e => setNewElectionSlug(e.target.value)}
                                            placeholder="nouveau-slug-election"
                                            className="w-full bg-white border-4 border-stone-900 p-3 font-mono text-xs"
                                        />
                                        <button
                                            onClick={addElectionSlug}
                                            className="px-4 py-3 bg-stone-900 text-white border-4 border-stone-900 text-[10px] font-black uppercase tracking-widest"
                                        >
                                            Ajouter slug
                                        </button>
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Slug analyse cible (daemon elections)</label>
                                        <select
                                            value={form.election_analysis_target_slug || 'municipales-2026'}
                                            onChange={e => updateForm('election_analysis_target_slug', e.target.value)}
                                            className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs"
                                        >
                                            {electionSlugs.map(slug => <option key={`target-${slug}`} value={slug}>{slug}</option>)}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Slugs visibles en front (ordre d'affichage)</label>
                                        {displaySlugs.length === 0 && <div className="text-[10px] font-black uppercase text-stone-400">Aucun slug visible pour le moment.</div>}
                                        {displaySlugs.map((slug, idx) => (
                                            <div key={`display-${slug}`} className="flex items-center gap-2 bg-white border-2 border-stone-900 p-2">
                                                <span className="text-[10px] font-black uppercase w-7 text-center">{idx + 1}</span>
                                                <span className="flex-1 text-[10px] font-black uppercase">{slug}</span>
                                                <button onClick={() => moveDisplaySlug(slug, -1)} className="px-2 py-1 border-2 border-stone-900 text-[10px] font-black uppercase">↑</button>
                                                <button onClick={() => moveDisplaySlug(slug, 1)} className="px-2 py-1 border-2 border-stone-900 text-[10px] font-black uppercase">↓</button>
                                                <button onClick={() => toggleSlugDisplay(slug, false)} className="px-2 py-1 bg-red-700 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Hide</button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {electionSlugs.map((slug) => {
                                            const sourceCfg = { ...DEFAULT_SOURCE_CFG, ...(electionSourcesMap[slug] || {}) };
                                            const daemonCfg = { ...DEFAULT_DAEMON_CFG, ...(electionDaemonMap[slug] || {}) };
                                            const isShown = displaySlugs.includes(slug);
                                            const isTarget = (form.election_analysis_target_slug || 'municipales-2026') === slug;
                                            const lastUsed = lastUsedSourcesMap[slug] || null;
                                            return (
                                                <div key={`slug-card-${slug}`} className="bg-white border-4 border-stone-900 p-4 space-y-4">
                                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                                        <div>
                                                            <h5 className="text-sm font-black uppercase tracking-widest">{slug}</h5>
                                                            <div className="text-[10px] font-black uppercase text-stone-500">{isTarget ? 'Slug cible du daemon' : 'Slug secondaire'}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <button onClick={() => toggleSlugDisplay(slug, !isShown)} className={`px-3 py-2 border-2 border-stone-900 text-[10px] font-black uppercase ${isShown ? 'bg-stone-900 text-white' : 'bg-white text-stone-900'}`}>
                                                                {isShown ? 'Visible front' : 'Afficher front'}
                                                            </button>
                                                            {!displaySlugs.includes(slug) && (
                                                                <button onClick={() => toggleSlugDisplay(slug, true)} className="px-3 py-2 bg-emerald-700 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Show</button>
                                                            )}
                                                            <button onClick={() => removeElectionSlug(slug)} className="px-3 py-2 bg-red-700 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Supprimer</button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div className="space-y-2 p-3 border-2 border-stone-900 bg-stone-50">
                                                            <div className="text-[10px] font-black uppercase text-stone-500">Source Etat</div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase">Source active</span>
                                                                <Toggle checked={sourceCfg.enabled !== false && sourceCfg.enabled !== 'false'} onChange={v => updateSourceCfg(slug, 'enabled', v)} />
                                                            </div>
                                                            <input type="text" value={sourceCfg.source_url || ''} onChange={e => updateSourceCfg(slug, 'source_url', e.target.value)} placeholder="URL fichier Etat (optionnel)" className="w-full bg-white border-2 border-stone-900 p-2 font-mono text-xs" />
                                                            <input type="text" value={sourceCfg.dataset_first_tour || ''} onChange={e => updateSourceCfg(slug, 'dataset_first_tour', e.target.value)} placeholder="Dataset API premier tour" className="w-full bg-white border-2 border-stone-900 p-2 font-mono text-xs" />
                                                            <input type="text" value={sourceCfg.dataset_second_tour || ''} onChange={e => updateSourceCfg(slug, 'dataset_second_tour', e.target.value)} placeholder="Dataset API second tour" className="w-full bg-white border-2 border-stone-900 p-2 font-mono text-xs" />
                                                            <input type="text" value={sourceCfg.candidate_first_tour || ''} onChange={e => updateSourceCfg(slug, 'candidate_first_tour', e.target.value)} placeholder="Dataset candidats premier tour" className="w-full bg-white border-2 border-stone-900 p-2 font-mono text-xs" />
                                                            <input type="text" value={sourceCfg.candidate_second_tour || ''} onChange={e => updateSourceCfg(slug, 'candidate_second_tour', e.target.value)} placeholder="Dataset candidats second tour" className="w-full bg-white border-2 border-stone-900 p-2 font-mono text-xs" />
                                                        </div>

                                                        <div className="space-y-2 p-3 border-2 border-stone-900 bg-stone-50">
                                                            <div className="text-[10px] font-black uppercase text-stone-500">Daemon live par slug</div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase">Daemon ON</span>
                                                                <Toggle checked={daemonCfg.enabled === true || daemonCfg.enabled === 'true'} onChange={v => updateDaemonCfg(slug, 'enabled', v)} />
                                                            </div>
                                                            
                                                        </div>
                                                    </div>

                                                    <div className="p-3 bg-stone-100 border-2 border-stone-900">
                                                        <div className="text-[10px] font-black uppercase text-stone-500 mb-1">Derniere source utilisee (audit)</div>
                                                        <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">{lastUsed ? JSON.stringify(lastUsed, null, 2) : 'Aucune execution source enregistree pour ce slug.'}</pre>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
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
                                            <input type="text" value={form.video_prefilter_model || 'gemini-3-flash-preview'} onChange={e => updateForm('video_prefilter_model', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Transcribe Model</label>
                                            <input type="text" value={form.video_transcribe_model || 'gemini-3-flash-preview'} onChange={e => updateForm('video_transcribe_model', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" />
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
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-black uppercase tracking-tighter font-headline">Image Engine</h3>
                                        <button
                                            onClick={handleTestImages}
                                            disabled={isTestingImages}
                                            className="bg-stone-900 text-white px-4 py-2 border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-stone-900 transition-colors disabled:opacity-60"
                                        >
                                            {isTestingImages ? 'Test...' : 'Tester 1:1 + 16:9'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-4 bg-stone-50 border-4 border-stone-900">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Fond keyword libre de droit</span>
                                            <Toggle checked={form.image_overlay_enabled !== 'false'} onChange={v => updateForm('image_overlay_enabled', v ? 'true' : 'false')} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Opacite fond keyword (0-1)</label>
                                            <input type="number" step="0.05" min="0" max="1" value={form.image_overlay_opacity || '0.5'} onChange={e => updateForm('image_overlay_opacity', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Taille encadre 16:9 (0.55-1)</label>
                                            <input type="number" step="0.01" min="0.55" max="1" value={form.image_box_scale_169 || '0.78'} onChange={e => updateForm('image_box_scale_169', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Taille encadre 1:1 (0.55-1)</label>
                                            <input type="number" step="0.01" min="0.55" max="1" value={form.image_box_scale_1x1 || '0.78'} onChange={e => updateForm('image_box_scale_1x1', e.target.value)} className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-black text-xs" />
                                        </div>
                                    </div>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase">Le fond keyword est tire depuis une source libre de droit et applique en overlay sur les visuels.</p>
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
                                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6">Automation Modes</h4>
                                    <div className="p-5 bg-amber-50 border-4 border-stone-900 space-y-3">
                                        <p className="text-xs font-black uppercase tracking-widest">Réglages déplacés vers Daemon</p>
                                        <p className="text-[10px] font-bold uppercase text-stone-500">Auto Publication (Approved), Auto Validation IA et Discord Test Mode sont maintenant centralisés dans Daemon pour une configuration unique.</p>
                                        <a href="/radar-admin/daemon" className="inline-block bg-stone-900 text-white px-4 py-2 border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest">Ouvrir Daemon Center</a>
                                    </div>
                                </section>

                                <section className="space-y-6">
                                    <h4 className="text-xs font-black uppercase tracking-widest text-stone-400 mb-6">Orchestration Daemon</h4>
                                    <div className="p-5 bg-amber-50 border-4 border-stone-900 space-y-3">
                                        <p className="text-xs font-black uppercase tracking-widest">Réglages avancés déplacés</p>
                                        <p className="text-[10px] font-bold uppercase text-stone-500">Les paramètres de scan, programmation horaire et tuning dynamique sont centralisés dans le Daemon Center pour éviter les doublons.</p>
                                        <a href="/radar-admin/daemon" className="inline-block bg-stone-900 text-white px-4 py-2 border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest">Ouvrir le Daemon Center</a>
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
