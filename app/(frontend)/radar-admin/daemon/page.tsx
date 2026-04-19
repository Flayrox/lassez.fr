'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { Toggle } from '../components/UIComponents';

type DaemonType = 'rss' | 'publisher';
type RssTypeLabel = '🔴 ALERTE INFO !';
type SocialTargetConfig = { mastodon: boolean; bluesky: boolean; twitter: boolean; discord: boolean };

type TuningRule = {
    id: string;
    name: string;
    daemons: DaemonType[];
    days: number[];
    start: string;
    end: string;
    overrides: {
        max_articles?: number;
        rss_lookback_hours?: number;
        min_delay_min?: number;
        max_delay_min?: number;
        scan_interval_hours?: number;
};
};

type DaemonProfile = {
    max_articles: string;
    rss_lookback_hours: string;
    min_delay_min: string;
    max_delay_min: string;
    scan_interval_hours: string;

};

type DaemonStatus = {
    daemonHealth?: { status: string; message: string };
    nextScanAt?: string | null;
    lastScanAt?: string | null;
    schedule?: { mode: string; times: string[]; intervalHours: number };
    postCounts?: Record<string, number>;
    jobCounts?: Record<string, number>;
    runtime?: {
        rssEnabled: boolean;
        
        autoPilotEnabled: boolean;
        autoApproveEnabled: boolean;
    };
};

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
const RSS_TYPE_LABELS: RssTypeLabel[] = ['🔴 ALERTE INFO !'];

function buildDefaultSocialTargets(settings: any): Record<RssTypeLabel, SocialTargetConfig> {
    const globalFallback: SocialTargetConfig = {
        mastodon: settings?.social_mastodon_enabled !== 'false',
        bluesky: settings?.social_bluesky_enabled !== 'false',
        twitter: settings?.social_twitter_enabled !== 'false',
        discord: settings?.social_discord_enabled === 'true'
    };

    const defaults: Record<RssTypeLabel, SocialTargetConfig> = {
        '🔴 ALERTE INFO !': { ...globalFallback }
    };

    try {
        const parsed = settings?.social_targets_by_type_json ? JSON.parse(settings.social_targets_by_type_json) : null;
        if (!parsed || typeof parsed !== 'object') return defaults;

        for (const key of RSS_TYPE_LABELS) {
            if (parsed[key] && typeof parsed[key] === 'object') {
                defaults[key] = {
                    mastodon: parsed[key].mastodon !== undefined ? Boolean(parsed[key].mastodon) : defaults[key].mastodon,
                    bluesky: parsed[key].bluesky !== undefined ? Boolean(parsed[key].bluesky) : defaults[key].bluesky,
                    twitter: parsed[key].twitter !== undefined ? Boolean(parsed[key].twitter) : defaults[key].twitter,
                    discord: parsed[key].discord !== undefined ? Boolean(parsed[key].discord) : defaults[key].discord,
                };
            }
        }
    } catch (_) {
        return defaults;
    }

    return defaults;
}

function parseTimes(raw: string): string[] {
    return String(raw || '')
        .split(/[\n,;|\s]+/)
        .map(x => x.trim())
        .filter(Boolean)
        .filter(x => /^(\d{1,2}):(\d{2})$/.test(x))
        .map(x => {
            const [h, m] = x.split(':').map(Number);
            if (h < 0 || h > 23 || m < 0 || m > 59) return null;
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        })
        .filter((x): x is string => Boolean(x))
        .filter((x, idx, arr) => arr.indexOf(x) === idx)
        .sort();
}

function parseRules(raw: string): TuningRule[] {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((rule, i) => ({
                id: String(rule.id || `rule-${i + 1}`),
                name: String(rule.name || `Rule ${i + 1}`),
                daemons: Array.isArray(rule.daemons)
                    ? rule.daemons.filter((d: string) => ['rss', 'publisher'].includes(String(d)))
                    : ['rss'],
                days: Array.isArray(rule.days)
                    ? rule.days.map((d: any) => Number(d)).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)
                    : [1, 2, 3, 4, 5],
                start: String(rule.start || '07:00'),
                end: String(rule.end || '10:00'),
                overrides: {
                    max_articles: rule?.overrides?.max_articles !== undefined ? Number(rule.overrides.max_articles) : undefined,
                    rss_lookback_hours: rule?.overrides?.rss_lookback_hours !== undefined ? Number(rule.overrides.rss_lookback_hours) : undefined,
                    min_delay_min: rule?.overrides?.min_delay_min !== undefined ? Number(rule.overrides.min_delay_min) : undefined,
                    max_delay_min: rule?.overrides?.max_delay_min !== undefined ? Number(rule.overrides.max_delay_min) : undefined,
                    scan_interval_hours: rule?.overrides?.scan_interval_hours !== undefined ? Number(rule.overrides.scan_interval_hours) : undefined,
                }
            }))
            .filter((r: TuningRule) => /^(\d{2}):(\d{2})$/.test(r.start) && /^(\d{2}):(\d{2})$/.test(r.end));
    } catch (_) {
        return [];
    }
}

function toRulesJson(rules: TuningRule[]) {
    return JSON.stringify(rules.map(r => ({
        name: r.name,
        daemons: r.daemons,
        days: r.days,
        start: r.start,
        end: r.end,
        overrides: {
            ...(r.overrides.max_articles !== undefined ? { max_articles: r.overrides.max_articles } : {}),
            ...(r.overrides.rss_lookback_hours !== undefined ? { rss_lookback_hours: r.overrides.rss_lookback_hours } : {}),
            ...(r.overrides.min_delay_min !== undefined ? { min_delay_min: r.overrides.min_delay_min } : {}),
            ...(r.overrides.max_delay_min !== undefined ? { max_delay_min: r.overrides.max_delay_min } : {}),
            ...(r.overrides.scan_interval_hours !== undefined ? { scan_interval_hours: r.overrides.scan_interval_hours } : {}),

        }
    })), null, 2);
}

function formatDate(value?: string | null) {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('fr-FR');
}

export default function DaemonPage() {
    const [initialPayloadStr, setInitialPayloadStr] = useState<string | null>(null);
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<DaemonStatus | null>(null);

    const [daemonRssEnabled, setDaemonRssEnabled] = useState(true);
    
    const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
    const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);
    const [discordTestMode, setDiscordTestMode] = useState(false);

    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [rssIntervalEnabled, setRssIntervalEnabled] = useState(true);
    const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
    const [newScheduleTime, setNewScheduleTime] = useState('08:00');
    
    
    
    

    const [profilesOpen, setProfilesOpen] = useState(false);
    const [daemonProfiles, setDaemonProfiles] = useState<Record<DaemonType, DaemonProfile>>({
        rss: {
            max_articles: '3',
            rss_lookback_hours: '24',
            min_delay_min: '0',
            max_delay_min: '15',
            scan_interval_hours: '2'},
        publisher: {
            max_articles: '3',
            rss_lookback_hours: '24',
            min_delay_min: '0',
            max_delay_min: '15',
            scan_interval_hours: '2'},
        
    });

    const [tuningEnabled, setTuningEnabled] = useState(false);
    const [rules, setRules] = useState<TuningRule[]>([]);
    const [isTestingFlows, setIsTestingFlows] = useState(false);
    const [expandedPipeline, setExpandedPipeline] = useState<RssTypeLabel | null>(null);
    const [cortexVars, setCortexVars] = useState({
        ai_model_main: 'gemini-2.5-pro',
        ai_prompt: '',
        ai_prompt_relevance: '',
        ai_model_breaking: 'gemini-3.1-pro-preview',
        ai_prompt_breaking_enabled: 'true',
        google_search_breaking_enabled: 'true',
        ai_prompt_breaking: '',
        ai_model_standard: 'gemini-2.5-flash',
        ai_prompt_standard_enabled: 'true',
        google_search_standard_enabled: 'true',
        ai_prompt_standard: '',
        ai_model_decrypt: 'gemini-2.5-pro',
        ai_prompt_decrypt_enabled: 'true',
        google_search_decrypt_enabled: 'true',
        ai_prompt_decrypt: ''
    });


    const [modalOpen, setModalOpen] = useState(false);
    const [scanRunning, setScanRunning] = useState(false);

    const [scanLogs, setScanLogs] = useState('');
    const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
    const [scanEndedAt, setScanEndedAt] = useState<number | null>(null);
    const [socialTargetsByType, setSocialTargetsByType] = useState<Record<RssTypeLabel, SocialTargetConfig>>({
        '🔴 ALERTE INFO !': { mastodon: true, bluesky: true, twitter: true, discord: false }
    });

        const currentPayloadStr = useMemo(() => {
        return JSON.stringify({
            ...cortexVars,
            daemon_rss_enabled: daemonRssEnabled ? 'true' : 'false',
            auto_pilot_enabled: autoPilotEnabled ? 'true' : 'false',
            auto_approve_enabled: autoApproveEnabled ? 'true' : 'false',
            discord_test_mode: discordTestMode ? 'true' : 'false',
            daemon_rss_interval_enabled: rssIntervalEnabled ? 'true' : 'false',
            scan_interval_hours: daemonProfiles.rss.scan_interval_hours,
            max_articles: daemonProfiles.rss.max_articles,
            rss_lookback_hours: daemonProfiles.rss.rss_lookback_hours,
            min_delay_min: daemonProfiles.publisher.min_delay_min,
            max_delay_min: daemonProfiles.publisher.max_delay_min,
            daemon_rss_schedule_enabled: scheduleEnabled ? 'true' : 'false',
            daemon_rss_schedule_times: scheduleTimes.join(', '),
            daemon_dynamic_tuning_enabled: tuningEnabled ? 'true' : 'false',
            daemon_dynamic_tuning_rules: toRulesJson(rules),
            social_targets_by_type_json: JSON.stringify(socialTargetsByType),
            daemon_profiles_json: JSON.stringify(daemonProfiles)
        });
    }, [
        cortexVars, daemonRssEnabled, autoPilotEnabled, autoApproveEnabled, discordTestMode,
        rssIntervalEnabled, daemonProfiles, scheduleEnabled, scheduleTimes,
        tuningEnabled, rules, socialTargetsByType
    ]);

    const isDirty = initialPayloadStr !== null && currentPayloadStr !== initialPayloadStr;

    useEffect(() => {
        if (!settings) return;
        const timer = setTimeout(() => {
            setInitialPayloadStr(currentPayloadStr);
        }, 100);
        return () => clearTimeout(timer);
    }, [settings, currentPayloadStr]);

    useEffect(() => {
        if (!settings) return;
        setDaemonRssEnabled(settings.daemon_rss_enabled !== 'false');
        
        setAutoPilotEnabled(settings.auto_pilot_enabled === 'true');
        setAutoApproveEnabled(settings.auto_approve_enabled === 'true');
        setDiscordTestMode(settings.discord_test_mode === 'true');

        setScheduleEnabled(settings.daemon_rss_schedule_enabled === 'true');
        setRssIntervalEnabled(settings.daemon_rss_interval_enabled !== 'false');
        setScheduleTimes(parseTimes(settings.daemon_rss_schedule_times || ''));
        
        
        

        const globalBasedProfiles: Record<DaemonType, DaemonProfile> = {
            rss: {
                max_articles: String(settings.max_articles || '3'),
                rss_lookback_hours: String(settings.rss_lookback_hours || '24'),
                min_delay_min: String(settings.min_delay_min || '0'),
                max_delay_min: String(settings.max_delay_min || '15'),
                scan_interval_hours: String(settings.scan_interval_hours || '2')},
            publisher: {
                max_articles: String(settings.max_articles || '3'),
                rss_lookback_hours: String(settings.rss_lookback_hours || '24'),
                min_delay_min: String(settings.min_delay_min || '0'),
                max_delay_min: String(settings.max_delay_min || '15'),
                scan_interval_hours: String(settings.scan_interval_hours || '2')},
            
        };
        setDaemonProfiles(globalBasedProfiles);

        try {
            const parsed = settings.daemon_profiles_json ? JSON.parse(settings.daemon_profiles_json) : null;
            if (parsed && typeof parsed === 'object') {
                setDaemonProfiles({
                    rss: {
                        ...globalBasedProfiles.rss,
                        ...(parsed.rss || {})
                    },
                    publisher: {
                        ...globalBasedProfiles.publisher,
                        ...(parsed.publisher || {})
                    }
                });
            }
        } catch (_) {
            // ignore parse errors and keep defaults
        }

        setTuningEnabled(settings.daemon_dynamic_tuning_enabled === 'true');
        setRules(parseRules(settings.daemon_dynamic_tuning_rules || ''));
        setSocialTargetsByType(buildDefaultSocialTargets(settings));
    }, [settings]);

    const setSocialTarget = (typeLabel: RssTypeLabel, network: keyof SocialTargetConfig, value: boolean) => {
        setSocialTargetsByType(prev => ({
            ...prev,
            [typeLabel]: {
                ...prev[typeLabel],
                [network]: value
            }
        }));
    };

    const fetchDaemonStatus = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/radar/daemon-status');
            const data = await res.json();
            if (data.success) setStatus(data.status);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDaemonStatus();
        const id = setInterval(fetchDaemonStatus, 15000);
        return () => clearInterval(id);
    }, []);

    const validationError = useMemo(() => {
        for (const daemonKey of ['rss', 'publisher'] as DaemonType[]) {
            const p = daemonProfiles[daemonKey];
            const maxA = Number(p.max_articles);
            const lookback = Number(p.rss_lookback_hours);
            const minDelay = Number(p.min_delay_min);
            const maxDelay = Number(p.max_delay_min);
            const scanInt = Number(p.scan_interval_hours);
            

            if (!Number.isFinite(maxA) || maxA < 1 || maxA > 40) return `Max signals invalide pour ${daemonKey} (1-40).`;
            if (!Number.isFinite(lookback) || lookback < 1 || lookback > 240) return `Lookback invalide pour ${daemonKey} (1-240h).`;
            if (!Number.isFinite(minDelay) || minDelay < 0) return `Min delay invalide pour ${daemonKey}.`;
            if (!Number.isFinite(maxDelay) || maxDelay < 0) return `Max delay invalide pour ${daemonKey}.`;
            if (minDelay > maxDelay) return `Min delay doit etre <= Max delay pour ${daemonKey}.`;
            if (!Number.isFinite(scanInt) || scanInt < 0.1) return `Scan interval invalide pour ${daemonKey} (min 0.1h).`;
        }

        if (daemonRssEnabled && !rssIntervalEnabled && !scheduleEnabled) return 'RSS: active au moins un declencheur (intervalle et/ou heures fixes).';
        if (scheduleEnabled && scheduleTimes.length === 0) return 'Ajoute au moins une heure RSS en mode heures fixes.';
        return null;
    }, [daemonProfiles, daemonRssEnabled, rssIntervalEnabled, scheduleEnabled, scheduleTimes]);

    const addScheduleTime = () => {
        if (!/^(\d{2}):(\d{2})$/.test(newScheduleTime)) return;
        setScheduleTimes(prev => parseTimes([...prev, newScheduleTime].join(',')));
    };

    const removeScheduleTime = (value: string) => {
        setScheduleTimes(prev => prev.filter(x => x !== value));
    };



    const removeElectionScheduleTime = (value: string) => {
        
    };

    const updateDaemonProfile = (daemon: DaemonType, key: keyof DaemonProfile, value: string) => {
        setDaemonProfiles(prev => ({
            ...prev,
            [daemon]: {
                ...prev[daemon],
                [key]: value
            }
        }));
    };

    const addRule = () => {
        setRules(prev => ([...prev, {
            id: `rule-${Date.now()}`,
            name: `Rule ${prev.length + 1}`,
            daemons: ['rss'],
            days: [1, 2, 3, 4, 5],
            start: '07:00',
            end: '10:00',
            overrides: {}
        }]));
    };

    const updateRule = (id: string, patch: Partial<TuningRule>) => {
        setRules(prev => prev.map(rule => rule.id === id ? { ...rule, ...patch } : rule));
    };

    const updateRuleOverride = (id: string, key: keyof TuningRule['overrides'], value: string) => {
        setRules(prev => prev.map(rule => {
            if (rule.id !== id) return rule;
            const num = value === '' ? undefined : Number(value);
            return {
                ...rule,
                overrides: {
                    ...rule.overrides,
                    [key]: num
                }
            };
        }));
    };

    const toggleRuleDay = (id: string, day: number) => {
        setRules(prev => prev.map(rule => {
            if (rule.id !== id) return rule;
            const has = rule.days.includes(day);
            const days = has ? rule.days.filter(d => d !== day) : [...rule.days, day].sort((a, b) => a - b);
            return { ...rule, days };
        }));
    };

    const toggleRuleDaemon = (id: string, daemon: DaemonType) => {
        setRules(prev => prev.map(rule => {
            if (rule.id !== id) return rule;
            const has = rule.daemons.includes(daemon);
            const daemons = has ? rule.daemons.filter(d => d !== daemon) : [...rule.daemons, daemon];
            return { ...rule, daemons: daemons.length ? daemons : ['rss'] };
        }));
    };

    const deleteRule = (id: string) => {
        setRules(prev => prev.filter(rule => rule.id !== id));
    };

    const handleSave = async () => {
        if (validationError) {
            alert(validationError);
            return;
        }

        if (!daemonRssEnabled && !confirm('Tu desactives totalement le scan RSS/Telegram. Continuer ?')) {
            return;
        }

        if (autoPilotEnabled && !confirm('Auto Pilot va publier automatiquement les posts APPROVED. Continuer ?')) {
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ...cortexVars,
                daemon_rss_enabled: daemonRssEnabled ? 'true' : 'false',
                auto_pilot_enabled: autoPilotEnabled ? 'true' : 'false',
                auto_approve_enabled: autoApproveEnabled ? 'true' : 'false',
                discord_test_mode: discordTestMode ? 'true' : 'false',
                daemon_rss_interval_enabled: rssIntervalEnabled ? 'true' : 'false',

                scan_interval_hours: daemonProfiles.rss.scan_interval_hours,
                max_articles: daemonProfiles.rss.max_articles,
                rss_lookback_hours: daemonProfiles.rss.rss_lookback_hours,
                min_delay_min: daemonProfiles.publisher.min_delay_min,
                max_delay_min: daemonProfiles.publisher.max_delay_min,

                daemon_rss_schedule_enabled: scheduleEnabled ? 'true' : 'false',
                daemon_rss_schedule_times: scheduleTimes.join(', '),

                daemon_dynamic_tuning_enabled: tuningEnabled ? 'true' : 'false',
                daemon_dynamic_tuning_rules: toRulesJson(rules),
                social_targets_by_type_json: JSON.stringify(socialTargetsByType),

                daemon_profiles_json: JSON.stringify(daemonProfiles)
            };

            const res = await fetch('/api/radar/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (!data.success) {
                alert(data.error || 'Erreur de sauvegarde.');
                return;
            }

            await fetchSettings();
            await fetchDaemonStatus();
            setInitialPayloadStr(currentPayloadStr);
            alert('Configuration daemon sauvegardee.');
        } catch (e) {
            console.error(e);
            alert('Erreur reseau pendant la sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    const runManualScan = async () => {

        setModalOpen(true);
        setScanRunning(true);
        setScanLogs('');
        setScanStartedAt(Date.now());
        setScanEndedAt(null);

        try {
            const res = await fetch('/api/radar/trigger', { method: 'POST' });
            if (!res.ok || !res.body) {
                const text = await res.text().catch(() => '');
                setScanLogs(prev => prev + `\n❌ Impossible de lancer le scan. ${text}`);
                setScanRunning(false);
                setScanEndedAt(Date.now());
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                setScanLogs(prev => prev + chunk);
            }

            setScanLogs(prev => prev + '\n✅ Scan termine.');
        } catch (e: any) {
            setScanLogs(prev => prev + `\n❌ Erreur: ${e.message}`);
        } finally {
            setScanRunning(false);
            setScanEndedAt(Date.now());
            fetchDaemonStatus();
        }
    };

    const runManualElectionSync = async () => {

        setModalOpen(true);
        setScanRunning(true);
        setScanLogs('');
        setScanStartedAt(Date.now());
        setScanEndedAt(null);

        try {
            const res = await fetch('/api/radar/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'elections' })
            });
            if (!res.ok || !res.body) {
                const text = await res.text().catch(() => '');
                setScanLogs(prev => prev + `\n❌ Impossible de lancer la sync elections. ${text}`);
                setScanRunning(false);
                setScanEndedAt(Date.now());
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                setScanLogs(prev => prev + chunk);
            }

            setScanLogs(prev => prev + '\n✅ Sync elections terminee.');
        } catch (e: any) {
            setScanLogs(prev => prev + `\n❌ Erreur: ${e.message}`);
        } finally {
            setScanRunning(false);
            setScanEndedAt(Date.now());
            fetchDaemonStatus();
        }
    };

    const scanDurationSec = useMemo(() => {
        if (!scanStartedAt) return null;
        const end = scanEndedAt || Date.now();
        return Math.max(0, Math.round((end - scanStartedAt) / 1000));
    }, [scanStartedAt, scanEndedAt]);

    return (
        <DashboardLayout
            title="DAEMON COMMAND CENTER"
            subtitle={countdown || 'Pilotage complet RSS/Elections/Publisher'}
            isDaemonRunning={isDaemonRunning}
        >
            <div className="max-w-7xl font-label space-y-8">
                <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white border-4 border-stone-900 p-4">
                        <div className="text-[10px] font-black uppercase text-stone-500">Etat Daemon</div>
                        <div className="mt-2 text-sm font-black uppercase tracking-tight">
                            {loading ? '...' : (status?.daemonHealth?.message || '—')}
                        </div>
                    </div>
                    <div className="bg-white border-4 border-stone-900 p-4">
                        <div className="text-[10px] font-black uppercase text-stone-500">Prochain Scan</div>
                        <div className="mt-2 text-sm font-black uppercase tracking-tight">{formatDate(status?.nextScanAt)}</div>
                    </div>
                    <div className="bg-white border-4 border-stone-900 p-4">
                        <div className="text-[10px] font-black uppercase text-stone-500">Dernier Scan</div>
                        <div className="mt-2 text-sm font-black uppercase tracking-tight">{formatDate(status?.lastScanAt)}</div>
                    </div>
                    <div className="bg-white border-4 border-stone-900 p-4">
                        <div className="text-[10px] font-black uppercase text-stone-500">Queue</div>
                        <div className="mt-2 text-xs font-black uppercase tracking-tight">
                            PENDING {status?.postCounts?.PENDING || 0} | APPROVED {status?.postCounts?.APPROVED || 0}
                        </div>
                    </div>
                </section>

                <section className="bg-white border-4 border-stone-900 shadow-[10px_10px_0px_0px_#1A1C1C] p-8 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <h2 className="text-2xl font-black uppercase tracking-tighter font-headline">Runtime & Actions</h2>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setProfilesOpen(true)}
                                className="bg-white text-stone-900 px-5 py-3 border-4 border-stone-900 text-[10px] font-black uppercase tracking-widest"
                            >
                                Config par daemon
                            </button>
                            <button
                                onClick={runManualScan}
                                disabled={scanRunning}
                                className="bg-red-700 text-white px-5 py-3 border-4 border-stone-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                            >

                            </button>
                            <button
                                onClick={runManualElectionSync}
                                disabled={scanRunning}
                                className="bg-amber-600 text-white px-5 py-3 border-4 border-stone-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                            >

                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-stone-900 text-white px-5 py-3 border-4 border-stone-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                            >
                                {saving ? 'SAVE...' : 'SAVE DAEMON CONFIG'}
                            </button>
                        </div>
                    </div>

                    {validationError && (
                        <div className="p-3 border-2 border-red-700 bg-red-50 text-red-800 text-xs font-black uppercase tracking-widest">
                            {validationError}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-stone-500">Runtime Toggles</h3>
                            <div className="space-y-3">
                                
                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                    <span className="text-xs font-black uppercase">Auto Pilot</span>
                                    <Toggle checked={autoPilotEnabled} onChange={setAutoPilotEnabled} />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                    <span className="text-xs font-black uppercase">Auto Approve</span>
                                    <Toggle checked={autoApproveEnabled} onChange={setAutoApproveEnabled} />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                    <span className="text-xs font-black uppercase">Discord Test Mode</span>
                                    <Toggle checked={discordTestMode} onChange={setDiscordTestMode} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-stone-500">Configuration par daemon</h3>
                            <div className="p-4 bg-amber-50 border-2 border-stone-900 space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest">Tout est configurable par daemon dans la fenêtre dédiée</p>
                                <p className="text-[10px] font-bold uppercase text-stone-600">Intervalle / heures fixes + Max Signals/Scan + Lookback + Min/Max Delay pour chaque daemon.</p>
                                <button onClick={() => setProfilesOpen(true)} className="bg-stone-900 text-white px-4 py-2 border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest">Ouvrir la config détaillée</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-stone-500">Pipelines & Cibles par flux RSS</h3>
                        </div>
                        <div className="overflow-x-auto border-2 border-stone-900">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-stone-900 text-white">
                                        <th className="text-left p-3 font-black uppercase tracking-widest">Type & Pipeline Cortex</th>
                                        <th className="p-3 font-black uppercase tracking-widest">Mastodon</th>
                                        <th className="p-3 font-black uppercase tracking-widest">Bluesky</th>
                                        <th className="p-3 font-black uppercase tracking-widest">Twitter/X</th>
                                        <th className="p-3 font-black uppercase tracking-widest">Discord</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {RSS_TYPE_LABELS.map((typeLabel) => {
                                        const pipelineConfigs: Record<string, any> = {
                                            '🔴 ALERTE INFO !': { id: 'breaking', borderColor: 'border-red-700', bgColor: 'bg-red-700' }
                                        };
                                        const pipeline = pipelineConfigs[typeLabel];
                                        const isExpanded = expandedPipeline === typeLabel;
                                        
                                        return (
                                            <React.Fragment key={typeLabel}>
                                                <tr 
                                                    className="bg-white border-t-2 border-stone-200 cursor-pointer hover:bg-stone-50 transition-colors group"
                                                    onClick={() => setExpandedPipeline(isExpanded ? null : typeLabel)}
                                                >
                                                    <td className="p-3 font-black uppercase tracking-tight flex items-center justify-between gap-4 group-hover:text-stone-600 transition-colors">
                                                        <span>{typeLabel}</span>
                                                        {pipeline && (
                                                            <span className="text-[10px] text-stone-400 bg-stone-100 px-2 py-1 border border-stone-300 group-hover:bg-stone-900 group-hover:text-white transition-colors">
                                                                {isExpanded ? "Fermer Cortex ▲" : "Éditer Cerveau ▼"}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><Toggle checked={socialTargetsByType[typeLabel]?.mastodon ?? false} onChange={(v) => setSocialTarget(typeLabel, 'mastodon', v)} /></td>
                                                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><Toggle checked={socialTargetsByType[typeLabel]?.bluesky ?? false} onChange={(v) => setSocialTarget(typeLabel, 'bluesky', v)} /></td>
                                                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><Toggle checked={socialTargetsByType[typeLabel]?.twitter ?? false} onChange={(v) => setSocialTarget(typeLabel, 'twitter', v)} /></td>
                                                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}><Toggle checked={socialTargetsByType[typeLabel]?.discord ?? false} onChange={(v) => setSocialTarget(typeLabel, 'discord', v)} /></td>
                                                </tr>
                                                {isExpanded && pipeline && (
                                                    <tr className="bg-stone-50 border-x-4 border-b-4 border-stone-900 shadow-[inset_0px_4px_10px_rgba(0,0,0,0.1)]">
                                                        <td colSpan={5} className="p-6">
                                                            {(() => {
                                                                const enabledKey = 'ai_prompt_' + pipeline.id + '_enabled';
                                                                const modelKey = 'ai_model_' + pipeline.id;
                                                                const googleKey = 'google_search_' + pipeline.id + '_enabled';
                                                                const promptKey = 'ai_prompt_' + pipeline.id;

                                                                const isEnabled = cortexVars[enabledKey as keyof typeof cortexVars] === 'true';
                                                                const modelValue = cortexVars[modelKey as keyof typeof cortexVars] || 'gemini-3.1-pro-preview';
                                                                const googleEnabled = cortexVars[googleKey as keyof typeof cortexVars] === 'true';
                                                                const promptValue = cortexVars[promptKey as keyof typeof cortexVars] || '';

                                                                return (
                                                                    <div className={'border-4 ' + pipeline.borderColor + ' bg-white p-4 space-y-4 max-w-3xl mx-auto'}>
                                                                        <div className={'flex justify-between items-center ' + pipeline.bgColor + ' text-white px-3 py-2 -mx-4 -mt-4 mb-2'}>
                                                                            <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                                                                <span>🧠 Pipeline Intelligence</span>
                                                                                <span className="opacity-70">({pipeline.id})</span>
                                                                            </h3>
                                                                            <Toggle
                                                                                checked={isEnabled}
                                                                                onChange={v => setCortexVars({ ...cortexVars, [enabledKey]: v ? 'true' : 'false' })}
                                                                            />
                                                                        </div>
                                                                        <select
                                                                            value={modelValue}
                                                                            onChange={e => setCortexVars({ ...cortexVars, [modelKey]: e.target.value })}
                                                                            className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-[10px] uppercase"
                                                                        >
                                                                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</option>
                                                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                                                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                                        </select>
                                                                        <label className="flex items-center gap-2 text-[10px] font-black uppercase">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={googleEnabled}
                                                                                onChange={e => setCortexVars({ ...cortexVars, [googleKey]: e.target.checked ? 'true' : 'false' })}
                                                                            />
                                                                            Activer Recherche Google Web 
                                                                        </label>
                                                                        <textarea
                                                                            value={promptValue}
                                                                            onChange={e => setCortexVars({ ...cortexVars, [promptKey]: e.target.value })}
                                                                            rows={8}
                                                                            disabled={!isEnabled}
                                                                            className="w-full bg-stone-50 border-2 border-stone-900 p-2 text-[10px] disabled:opacity-50"
                                                                        />
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-[10px] font-bold uppercase text-stone-500 mt-2 block">
                            Ces cibles sont indépendantes pour chaque flux et remplacent la config globale.
                            Cliquer sur une ligne permet de régler le modèle de pensée et le prompt qui seront appliqués.
                        </p>
                    </div>
                </section>

                

                <section className="bg-white border-4 border-stone-900 shadow-[10px_10px_0px_0px_#1A1C1C] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black uppercase tracking-tighter font-headline">Dynamic Tuning Rules</h2>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase text-stone-500">Actif</span>
                            <Toggle checked={tuningEnabled} onChange={setTuningEnabled} />
                            <button onClick={addRule} className="bg-red-700 text-white px-3 py-2 border-2 border-stone-900 text-[10px] font-black uppercase tracking-widest">Add Rule</button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {rules.length === 0 && <div className="text-xs font-black uppercase text-stone-400">Aucune regle dynamique.</div>}
                        {rules.map(rule => (
                            <div key={rule.id} className="border-4 border-stone-900 p-4 bg-stone-50 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <input value={rule.name} onChange={e => updateRule(rule.id, { name: e.target.value })} className="flex-1 bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    <button onClick={() => deleteRule(rule.id)} className="px-3 py-2 bg-red-700 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Delete</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Start</label>
                                        <input type="time" value={rule.start} onChange={e => updateRule(rule.id, { start: e.target.value })} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">End</label>
                                        <input type="time" value={rule.end} onChange={e => updateRule(rule.id, { end: e.target.value })} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Daemons</label>
                                        <div className="flex gap-2">
                                            {(['rss', 'publisher'] as DaemonType[]).map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => toggleRuleDaemon(rule.id, d)}
                                                    className={`px-2 py-1 border-2 text-[10px] font-black uppercase ${rule.daemons.includes(d) ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-900'}`}
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Jours actifs</label>
                                    <div className="flex gap-2">
                                        {DAY_LABELS.map((lab, day) => (
                                            <button
                                                key={`${rule.id}-${day}`}
                                                onClick={() => toggleRuleDay(rule.id, day)}
                                                className={`w-8 h-8 border-2 text-[10px] font-black ${rule.days.includes(day) ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-900'}`}
                                            >
                                                {lab}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">max_articles</label>
                                        <input type="number" value={rule.overrides.max_articles ?? ''} onChange={e => updateRuleOverride(rule.id, 'max_articles', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">lookback h</label>
                                        <input type="number" value={rule.overrides.rss_lookback_hours ?? ''} onChange={e => updateRuleOverride(rule.id, 'rss_lookback_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">min delay</label>
                                        <input type="number" value={rule.overrides.min_delay_min ?? ''} onChange={e => updateRuleOverride(rule.id, 'min_delay_min', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">max delay</label>
                                        <input type="number" value={rule.overrides.max_delay_min ?? ''} onChange={e => updateRuleOverride(rule.id, 'max_delay_min', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">scan interval h</label>
                                        <input type="number" step="0.1" value={rule.overrides.scan_interval_hours ?? ''} onChange={e => updateRuleOverride(rule.id, 'scan_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">elections interval h</label>

                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-4xl bg-stone-50 border-4 border-stone-900 shadow-[12px_12px_0px_0px_#1A1C1C] p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black uppercase tracking-tighter">

                            </h3>
                            <button
                                onClick={() => !scanRunning && setModalOpen(false)}
                                className="px-3 py-1 border-2 border-stone-900 bg-white text-xs font-black uppercase disabled:opacity-50"
                                disabled={scanRunning}
                            >
                                Close
                            </button>
                        </div>

                        <div className="mb-3 text-[10px] font-black uppercase text-stone-500">
                            Etat: {scanRunning ? 'RUNNING' : 'FINISHED'}
                            {scanDurationSec !== null ? ` | Duree: ${scanDurationSec}s` : ''}
                            {scanEndedAt ? ` | Lignes: ${scanLogs.split('\n').filter(Boolean).length}` : ''}
                        </div>

                        <pre className="h-[420px] overflow-auto bg-stone-900 text-stone-100 p-4 border-2 border-stone-900 text-xs leading-relaxed whitespace-pre-wrap">
                            {scanLogs || 'Aucun log pour le moment...'}
                        </pre>
                    </div>
                </div>
            )}

            {profilesOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-5xl bg-stone-50 border-4 border-stone-900 shadow-[16px_16px_0px_0px_#1A1C1C] p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b-4 border-stone-900">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter font-headline flex items-center gap-3">
                                    <span className="text-xl">⚙️</span> Configuration Individuelle des Daemons
                                </h3>
                                <p className="text-xs font-bold text-stone-500 uppercase mt-2">Precision du Cycle de Vie (Scrape & Diffusion)</p>
                            </div>
                            <button onClick={() => setProfilesOpen(false)} className="px-6 py-2 bg-stone-900 text-white hover:bg-stone-700 transition-colors text-xs font-black uppercase tracking-widest border-2 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C]">
                                Sauvegarder & Fermer
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* RSS DAEMON - LE TRACTEUR */}
                            <div className="bg-white border-4 border-stone-900 p-6 flex flex-col gap-6">
                                <div className="bg-blue-600 text-white px-4 py-2 -mx-6 -mt-6 border-b-4 border-stone-900 mb-2 flex justify-between items-center">
                                    <h4 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">📡 Le Collecteur (RSS)</h4>
                                    <span className="text-[10px] bg-stone-900 px-2 py-1 font-bold uppercase border-2 border-stone-900">Inbound</span>
                                </div>
                                <p className="text-[10px] text-stone-500 uppercase font-bold">Gere la frequence de balayage des sources et le volume absorbe.</p>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-700 border-b-2 border-stone-200 pb-2">📅 Planification du Crawl</h5>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase">Intervalle Regulier</span>
                                        <Toggle checked={rssIntervalEnabled} onChange={setRssIntervalEnabled} />
                                    </div>
                                    {rssIntervalEnabled && (
                                        <div className="pl-4 border-l-4 border-blue-600 space-y-1">
                                            <label className="text-[10px] font-black uppercase text-stone-500 block">Frequence (Heures)</label>
                                            <div className="flex gap-4 items-center">
      <input type="range" min="0.1" max="24" step="0.1" value={daemonProfiles.rss.scan_interval_hours} onChange={e => updateDaemonProfile('rss', 'scan_interval_hours', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.rss.scan_interval_hours}h</div>
  </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-[10px] font-black uppercase">Heures Fixes (Horloge)</span>
                                        <Toggle checked={scheduleEnabled} onChange={setScheduleEnabled} />
                                    </div>
                                    {scheduleEnabled && (
                                        <div className="pl-4 border-l-4 border-blue-600 space-y-2">
                                            <div className="flex gap-2 items-stretch">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Nouvelle heure</label>
                                                    <input type="time" value={newScheduleTime} onChange={e => setNewScheduleTime(e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                                </div>
                                                <button onClick={addScheduleTime} className="px-4 py-2 mt-auto bg-stone-900 text-white font-black text-xs uppercase hover:bg-stone-700 transition-colors">+ Ajouter</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {scheduleTimes.length === 0 && <span className="text-xs text-stone-400 italic">Aucune heure fixee</span>}
                                                {scheduleTimes.map(t => (
                                                    <button key={`rss-${t}`} onClick={() => removeScheduleTime(t)} className="px-3 py-1 bg-white hover:bg-red-100 hover:text-red-700 hover:border-red-700 text-stone-900 border-2 border-stone-900 text-[10px] font-black transition-colors group flex items-center gap-1">
                                                        {t} <span className="text-stone-400 group-hover:text-red-700">✕</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-700 border-b-2 border-stone-200 pb-2">🧱 Limites d'Absorption</h5>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Articles / Scan</label>
                                            <div className="flex gap-4 items-center">
      <input type="range" min="1" max="500" step="1" value={daemonProfiles.rss.max_articles} onChange={e => updateDaemonProfile('rss', 'max_articles', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.rss.max_articles}</div>
  </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Lookback Historique (h)</label>
                                            <div className="flex gap-4 items-center">
      <input type="range" min="1" max="168" step="1" value={daemonProfiles.rss.rss_lookback_hours} onChange={e => updateDaemonProfile('rss', 'rss_lookback_hours', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.rss.rss_lookback_hours}h</div>
  </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* PUBLISHER DAEMON - LA MACHINE A ECRIRE */}
                            <div className="bg-white border-4 border-stone-900 p-6 flex flex-col gap-6">
                                <div className="bg-emerald-600 text-white px-4 py-2 -mx-6 -mt-6 border-b-4 border-stone-900 mb-2 flex justify-between items-center">
                                    <h4 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">🚀 Le Diffuseur (Publisher)</h4>
                                    <span className="text-[10px] bg-stone-900 px-2 py-1 font-bold uppercase border-2 border-stone-900">Outbound</span>
                                </div>
                                <p className="text-[10px] text-stone-500 uppercase font-bold">Gere la cadence de publication, les delais et le rythme d'ecriture.</p>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 border-b-2 border-stone-200 pb-2">⚡ Cadence de Publication</h5>
                                    
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Intervalle entre Cycles (h)</label>
                                        <div className="flex gap-4 items-center">
      <input type="range" min="0.1" max="24" step="0.1" value={daemonProfiles.publisher.scan_interval_hours} onChange={e => updateDaemonProfile('publisher', 'scan_interval_hours', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.scan_interval_hours}h</div>
  </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Articles / Cycle (Limite Session)</label>
                                        <div className="flex gap-4 items-center">
      <input type="range" min="1" max="500" step="1" value={daemonProfiles.publisher.max_articles} onChange={e => updateDaemonProfile('publisher', 'max_articles', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.max_articles}</div>
  </div>
                                    </div>
                                </div>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 border-b-2 border-stone-200 pb-2">⏱ Delais & Anti-Spam</h5>
                                    <p className="text-[9px] font-bold text-stone-400 mb-2 uppercase leading-tight">Assure une repartition organique des publications et simule une activite humaine.</p>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Min Delay (minutes)</label>
                                            <div className="flex gap-4 items-center">
      <input type="range" min="1" max="60" step="1" value={daemonProfiles.publisher.min_delay_min} onChange={e => updateDaemonProfile('publisher', 'min_delay_min', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.min_delay_min}m</div>
  </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Delay (minutes)</label>
                                            <div className="flex gap-4 items-center">
      <input type="range" min="1" max="120" step="1" value={daemonProfiles.publisher.max_delay_min} onChange={e => updateDaemonProfile('publisher', 'max_delay_min', e.target.value)} className="flex-1 accent-stone-900 h-2 bg-stone-300 rounded-none cursor-pointer appearance-none" />
      <div className="w-16 bg-white border-2 border-stone-900 p-2 text-center font-black text-xs">{daemonProfiles.publisher.max_delay_min}m</div>
  </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-6 bg-amber-50 border-4 border-amber-400 p-4 font-black flex items-center justify-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <span className="text-[10px] uppercase text-amber-900 tracking-widest">
                                N'oubliez pas : Les modifications prendront effet apres avoir clique sur "Enregistrer" dans la section principale.
                            </span>
                        </div>
                    </div>
                </div>
            )}
 
            {/* FLOATING SAVE BUTTON */}
            <div 
                className={`fixed bottom-8 right-8 z-[100] transition-all duration-500 ease-in-out ${isDirty ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'}`}
            >
                <div className="relative group">
                    <div className="absolute -inset-1 bg-red-700 blur opacity-25 group-hover:opacity-75 transition duration-200"></div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="relative flex items-center gap-3 bg-red-700 text-white px-6 py-4 border-4 border-stone-900 font-black uppercase tracking-widest shadow-[8px_8px_0px_0px_rgba(26,28,28,1)] hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(26,28,28,1)] transition-all animate-pulse"
                    >
                        <span className="text-xl">⚠️</span>
                        <div>
                            <div>{saving ? 'SAUVEGARDE...' : 'CHANGEMENTS NON SAUVÉGARDÉS'}</div>
                            <div className="text-[10px] text-red-200 font-bold">Cliquez pour appliquer la configuration</div>
                        </div>
                    </button>
                </div>
            </div>

        </DashboardLayout>
    );
}
