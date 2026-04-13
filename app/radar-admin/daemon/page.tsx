'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useRadarAdmin } from '../components/RadarAdminContext';
import { Toggle } from '../components/UIComponents';

type DaemonType = 'rss' | 'publisher' | 'elections';

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
        election_interval_hours?: number;
    };
};

type DaemonProfile = {
    max_articles: string;
    rss_lookback_hours: string;
    min_delay_min: string;
    max_delay_min: string;
    scan_interval_hours: string;
    election_interval_hours: string;
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
        electionsEnabled: boolean;
        autoPilotEnabled: boolean;
        autoApproveEnabled: boolean;
    };
};

const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

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
                    ? rule.daemons.filter((d: string) => ['rss', 'publisher', 'elections'].includes(String(d)))
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
                    election_interval_hours: rule?.overrides?.election_interval_hours !== undefined ? Number(rule.overrides.election_interval_hours) : undefined,
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
            ...(r.overrides.election_interval_hours !== undefined ? { election_interval_hours: r.overrides.election_interval_hours } : {}),
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
    const { settings, fetchSettings, isDaemonRunning, countdown } = useRadarAdmin();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [status, setStatus] = useState<DaemonStatus | null>(null);

    const [daemonRssEnabled, setDaemonRssEnabled] = useState(true);
    const [daemonElectionsEnabled, setDaemonElectionsEnabled] = useState(false);
    const [autoPilotEnabled, setAutoPilotEnabled] = useState(false);
    const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);

    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [rssIntervalEnabled, setRssIntervalEnabled] = useState(true);
    const [scheduleTimes, setScheduleTimes] = useState<string[]>([]);
    const [newScheduleTime, setNewScheduleTime] = useState('08:00');
    const [electionsScheduleEnabled, setElectionsScheduleEnabled] = useState(false);
    const [electionsIntervalEnabled, setElectionsIntervalEnabled] = useState(true);
    const [electionsScheduleTimes, setElectionsScheduleTimes] = useState<string[]>([]);
    const [newElectionScheduleTime, setNewElectionScheduleTime] = useState('09:00');

    const [profilesOpen, setProfilesOpen] = useState(false);
    const [daemonProfiles, setDaemonProfiles] = useState<Record<DaemonType, DaemonProfile>>({
        rss: {
            max_articles: '3',
            rss_lookback_hours: '24',
            min_delay_min: '0',
            max_delay_min: '15',
            scan_interval_hours: '2',
            election_interval_hours: '0.5'
        },
        publisher: {
            max_articles: '3',
            rss_lookback_hours: '24',
            min_delay_min: '0',
            max_delay_min: '15',
            scan_interval_hours: '2',
            election_interval_hours: '0.5'
        },
        elections: {
            max_articles: '3',
            rss_lookback_hours: '24',
            min_delay_min: '0',
            max_delay_min: '15',
            scan_interval_hours: '2',
            election_interval_hours: '0.5'
        }
    });

    const [tuningEnabled, setTuningEnabled] = useState(false);
    const [rules, setRules] = useState<TuningRule[]>([]);

    const [modalOpen, setModalOpen] = useState(false);
    const [scanRunning, setScanRunning] = useState(false);
    const [manualAction, setManualAction] = useState<'scan' | 'elections'>('scan');
    const [scanLogs, setScanLogs] = useState('');
    const [scanStartedAt, setScanStartedAt] = useState<number | null>(null);
    const [scanEndedAt, setScanEndedAt] = useState<number | null>(null);

    useEffect(() => {
        if (!settings) return;
        setDaemonRssEnabled(settings.daemon_rss_enabled !== 'false');
        setDaemonElectionsEnabled(settings.daemon_elections_enabled === 'true');
        setAutoPilotEnabled(settings.auto_pilot_enabled === 'true');
        setAutoApproveEnabled(settings.auto_approve_enabled === 'true');

        setScheduleEnabled(settings.daemon_rss_schedule_enabled === 'true');
        setRssIntervalEnabled(settings.daemon_rss_interval_enabled !== 'false');
        setScheduleTimes(parseTimes(settings.daemon_rss_schedule_times || ''));
        setElectionsScheduleEnabled(settings.daemon_elections_schedule_enabled === 'true');
        setElectionsIntervalEnabled(settings.daemon_elections_interval_enabled !== 'false');
        setElectionsScheduleTimes(parseTimes(settings.daemon_elections_schedule_times || ''));

        const globalBasedProfiles: Record<DaemonType, DaemonProfile> = {
            rss: {
                max_articles: String(settings.max_articles || '3'),
                rss_lookback_hours: String(settings.rss_lookback_hours || '24'),
                min_delay_min: String(settings.min_delay_min || '0'),
                max_delay_min: String(settings.max_delay_min || '15'),
                scan_interval_hours: String(settings.scan_interval_hours || '2'),
                election_interval_hours: String(settings.election_interval_hours || '0.5')
            },
            publisher: {
                max_articles: String(settings.max_articles || '3'),
                rss_lookback_hours: String(settings.rss_lookback_hours || '24'),
                min_delay_min: String(settings.min_delay_min || '0'),
                max_delay_min: String(settings.max_delay_min || '15'),
                scan_interval_hours: String(settings.scan_interval_hours || '2'),
                election_interval_hours: String(settings.election_interval_hours || '0.5')
            },
            elections: {
                max_articles: String(settings.max_articles || '3'),
                rss_lookback_hours: String(settings.rss_lookback_hours || '24'),
                min_delay_min: String(settings.min_delay_min || '0'),
                max_delay_min: String(settings.max_delay_min || '15'),
                scan_interval_hours: String(settings.scan_interval_hours || '2'),
                election_interval_hours: String(settings.election_interval_hours || '0.5')
            }
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
                    },
                    elections: {
                        ...globalBasedProfiles.elections,
                        ...(parsed.elections || {})
                    }
                });
            }
        } catch (_) {
            // ignore parse errors and keep defaults
        }

        setTuningEnabled(settings.daemon_dynamic_tuning_enabled === 'true');
        setRules(parseRules(settings.daemon_dynamic_tuning_rules || ''));
    }, [settings]);

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
        for (const daemonKey of ['rss', 'publisher', 'elections'] as DaemonType[]) {
            const p = daemonProfiles[daemonKey];
            const maxA = Number(p.max_articles);
            const lookback = Number(p.rss_lookback_hours);
            const minDelay = Number(p.min_delay_min);
            const maxDelay = Number(p.max_delay_min);
            const scanInt = Number(p.scan_interval_hours);
            const electionInt = Number(p.election_interval_hours);

            if (!Number.isFinite(maxA) || maxA < 1 || maxA > 40) return `Max signals invalide pour ${daemonKey} (1-40).`;
            if (!Number.isFinite(lookback) || lookback < 1 || lookback > 240) return `Lookback invalide pour ${daemonKey} (1-240h).`;
            if (!Number.isFinite(minDelay) || minDelay < 0) return `Min delay invalide pour ${daemonKey}.`;
            if (!Number.isFinite(maxDelay) || maxDelay < 0) return `Max delay invalide pour ${daemonKey}.`;
            if (minDelay > maxDelay) return `Min delay doit etre <= Max delay pour ${daemonKey}.`;
            if (!Number.isFinite(scanInt) || scanInt < 0.1) return `Scan interval invalide pour ${daemonKey} (min 0.1h).`;
            if (!Number.isFinite(electionInt) || electionInt < 0.1) return `Elections interval invalide pour ${daemonKey} (min 0.1h).`;
        }

        if (daemonRssEnabled && !rssIntervalEnabled && !scheduleEnabled) return 'RSS: active au moins un declencheur (intervalle et/ou heures fixes).';
        if (daemonElectionsEnabled && !electionsIntervalEnabled && !electionsScheduleEnabled) return 'Elections: active au moins un declencheur (intervalle et/ou heures fixes).';
        if (scheduleEnabled && scheduleTimes.length === 0) return 'Ajoute au moins une heure RSS en mode heures fixes.';
        if (electionsScheduleEnabled && electionsScheduleTimes.length === 0) return 'Ajoute au moins une heure Elections en mode heures fixes.';
        return null;
    }, [daemonProfiles, daemonRssEnabled, daemonElectionsEnabled, rssIntervalEnabled, scheduleEnabled, scheduleTimes, electionsIntervalEnabled, electionsScheduleEnabled, electionsScheduleTimes]);

    const addScheduleTime = () => {
        if (!/^(\d{2}):(\d{2})$/.test(newScheduleTime)) return;
        setScheduleTimes(prev => parseTimes([...prev, newScheduleTime].join(',')));
    };

    const removeScheduleTime = (value: string) => {
        setScheduleTimes(prev => prev.filter(x => x !== value));
    };

    const addElectionScheduleTime = () => {
        if (!/^(\d{2}):(\d{2})$/.test(newElectionScheduleTime)) return;
        setElectionsScheduleTimes(prev => parseTimes([...prev, newElectionScheduleTime].join(',')));
    };

    const removeElectionScheduleTime = (value: string) => {
        setElectionsScheduleTimes(prev => prev.filter(x => x !== value));
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
                daemon_rss_enabled: daemonRssEnabled ? 'true' : 'false',
                daemon_elections_enabled: daemonElectionsEnabled ? 'true' : 'false',
                auto_pilot_enabled: autoPilotEnabled ? 'true' : 'false',
                auto_approve_enabled: autoApproveEnabled ? 'true' : 'false',
                daemon_rss_interval_enabled: rssIntervalEnabled ? 'true' : 'false',
                daemon_elections_interval_enabled: electionsIntervalEnabled ? 'true' : 'false',

                scan_interval_hours: daemonProfiles.rss.scan_interval_hours,
                election_interval_hours: daemonProfiles.elections.election_interval_hours,
                max_articles: daemonProfiles.rss.max_articles,
                rss_lookback_hours: daemonProfiles.rss.rss_lookback_hours,
                min_delay_min: daemonProfiles.publisher.min_delay_min,
                max_delay_min: daemonProfiles.publisher.max_delay_min,

                daemon_rss_schedule_enabled: scheduleEnabled ? 'true' : 'false',
                daemon_rss_schedule_times: scheduleTimes.join(', '),
                daemon_elections_schedule_enabled: electionsScheduleEnabled ? 'true' : 'false',
                daemon_elections_schedule_times: electionsScheduleTimes.join(', '),

                daemon_dynamic_tuning_enabled: tuningEnabled ? 'true' : 'false',
                daemon_dynamic_tuning_rules: toRulesJson(rules),

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
            alert('Configuration daemon sauvegardee.');
        } catch (e) {
            console.error(e);
            alert('Erreur reseau pendant la sauvegarde.');
        } finally {
            setSaving(false);
        }
    };

    const runManualScan = async () => {
        setManualAction('scan');
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
        setManualAction('elections');
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
                                {scanRunning && manualAction === 'scan' ? 'SCAN EN COURS...' : 'RUN MANUAL SCAN'}
                            </button>
                            <button
                                onClick={runManualElectionSync}
                                disabled={scanRunning}
                                className="bg-amber-600 text-white px-5 py-3 border-4 border-stone-900 text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
                            >
                                {scanRunning && manualAction === 'elections' ? 'SYNC ELECTIONS...' : 'RUN MANUAL ELECTIONS'}
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
                                    <span className="text-xs font-black uppercase">Daemon RSS</span>
                                    <Toggle checked={daemonRssEnabled} onChange={setDaemonRssEnabled} />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                    <span className="text-xs font-black uppercase">Daemon Elections</span>
                                    <Toggle checked={daemonElectionsEnabled} onChange={setDaemonElectionsEnabled} />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                    <span className="text-xs font-black uppercase">Auto Pilot</span>
                                    <Toggle checked={autoPilotEnabled} onChange={setAutoPilotEnabled} />
                                </div>
                                <div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">
                                    <span className="text-xs font-black uppercase">Auto Approve</span>
                                    <Toggle checked={autoApproveEnabled} onChange={setAutoApproveEnabled} />
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
                </section>

                <section className="bg-white border-4 border-stone-900 shadow-[10px_10px_0px_0px_#1A1C1C] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black uppercase tracking-tighter font-headline">Scheduling ET/OU</h2>
                        <div className="text-[10px] font-black uppercase tracking-widest text-stone-500">Intervalle + Heures fixes peuvent coexister</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="border-2 border-stone-900 bg-stone-50 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-widest">RSS</h3>
                                <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 ${rssIntervalEnabled && scheduleEnabled ? 'bg-red-700 text-white border-red-700' : (rssIntervalEnabled || scheduleEnabled ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-400')}`}>
                                    {rssIntervalEnabled && scheduleEnabled ? 'HYBRID ET/OU' : (rssIntervalEnabled ? 'INTERVALLE' : (scheduleEnabled ? 'HEURES FIXES' : 'OFF'))}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-white border-2 border-stone-900">
                                <span className="text-xs font-black uppercase">Intervalle RSS</span>
                                <Toggle checked={rssIntervalEnabled} onChange={setRssIntervalEnabled} />
                            </div>
                            {rssIntervalEnabled && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Toutes les x heures</label>
                                    <input type="number" step="0.1" value={daemonProfiles.rss.scan_interval_hours} onChange={e => updateDaemonProfile('rss', 'scan_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                </div>
                            )}

                            <div className="flex items-center justify-between p-3 bg-white border-2 border-stone-900">
                                <span className="text-xs font-black uppercase">Heures fixes RSS</span>
                                <Toggle checked={scheduleEnabled} onChange={setScheduleEnabled} />
                            </div>
                            {scheduleEnabled && (
                                <>
                                    <div className="flex gap-2 items-end">
                                        <input type="time" value={newScheduleTime} onChange={e => setNewScheduleTime(e.target.value)} className="bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                        <button onClick={addScheduleTime} className="px-3 py-2 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Ajouter</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {scheduleTimes.length === 0 && <span className="text-[10px] font-black uppercase text-stone-400">Aucune heure configuree</span>}
                                        {scheduleTimes.map(t => (
                                            <button key={`rss-main-${t}`} onClick={() => removeScheduleTime(t)} className="px-2 py-1 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">{t} ✕</button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="border-2 border-stone-900 bg-stone-50 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-widest">Elections</h3>
                                <span className={`px-2 py-1 text-[10px] font-black uppercase border-2 ${electionsIntervalEnabled && electionsScheduleEnabled ? 'bg-red-700 text-white border-red-700' : (electionsIntervalEnabled || electionsScheduleEnabled ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-500 border-stone-400')}`}>
                                    {electionsIntervalEnabled && electionsScheduleEnabled ? 'HYBRID ET/OU' : (electionsIntervalEnabled ? 'INTERVALLE' : (electionsScheduleEnabled ? 'HEURES FIXES' : 'OFF'))}
                                </span>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-white border-2 border-stone-900">
                                <span className="text-xs font-black uppercase">Intervalle Elections</span>
                                <Toggle checked={electionsIntervalEnabled} onChange={setElectionsIntervalEnabled} />
                            </div>
                            {electionsIntervalEnabled && (
                                <div>
                                    <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Toutes les x heures</label>
                                    <input type="number" step="0.1" value={daemonProfiles.elections.election_interval_hours} onChange={e => updateDaemonProfile('elections', 'election_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                </div>
                            )}

                            <div className="flex items-center justify-between p-3 bg-white border-2 border-stone-900">
                                <span className="text-xs font-black uppercase">Heures fixes Elections</span>
                                <Toggle checked={electionsScheduleEnabled} onChange={setElectionsScheduleEnabled} />
                            </div>
                            {electionsScheduleEnabled && (
                                <>
                                    <div className="flex gap-2 items-end">
                                        <input type="time" value={newElectionScheduleTime} onChange={e => setNewElectionScheduleTime(e.target.value)} className="bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                        <button onClick={addElectionScheduleTime} className="px-3 py-2 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Ajouter</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {electionsScheduleTimes.length === 0 && <span className="text-[10px] font-black uppercase text-stone-400">Aucune heure configuree</span>}
                                        {electionsScheduleTimes.map(t => (
                                            <button key={`elections-main-${t}`} onClick={() => removeElectionScheduleTime(t)} className="px-2 py-1 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">{t} ✕</button>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
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
                                            {(['rss', 'publisher', 'elections'] as DaemonType[]).map(d => (
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
                                        <input type="number" step="0.1" value={rule.overrides.election_interval_hours ?? ''} onChange={e => updateRuleOverride(rule.id, 'election_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
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
                                {manualAction === 'elections' ? 'Manual Elections Sync Live Logs' : 'Manual Scan Live Logs'}
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
                <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-6xl bg-stone-50 border-4 border-stone-900 shadow-[12px_12px_0px_0px_#1A1C1C] p-6 max-h-[90vh] overflow-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black uppercase tracking-tighter">Configuration individuelle par daemon</h3>
                            <button onClick={() => setProfilesOpen(false)} className="px-3 py-1 border-2 border-stone-900 bg-white text-xs font-black uppercase">Fermer</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {(['rss', 'publisher', 'elections'] as DaemonType[]).map((daemonKey) => (
                                <div key={daemonKey} className="border-4 border-stone-900 bg-white p-4 space-y-3">
                                    <h4 className="text-sm font-black uppercase tracking-widest">{daemonKey}</h4>
                                    {daemonKey === 'rss' && (
                                        <div className="space-y-2 p-3 border-2 border-stone-900 bg-stone-50">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase">Intervalle RSS</span>
                                                <Toggle checked={rssIntervalEnabled} onChange={setRssIntervalEnabled} />
                                            </div>
                                            {rssIntervalEnabled && (
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Scan toutes les x heures</label>
                                                    <input type="number" step="0.1" value={daemonProfiles.rss.scan_interval_hours} onChange={e => updateDaemonProfile('rss', 'scan_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase">Heures fixes RSS</span>
                                                <Toggle checked={scheduleEnabled} onChange={setScheduleEnabled} />
                                            </div>
                                            {scheduleEnabled && (
                                                <>
                                                    <div className="flex gap-2 items-end">
                                                        <input type="time" value={newScheduleTime} onChange={e => setNewScheduleTime(e.target.value)} className="bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                                        <button onClick={addScheduleTime} className="px-3 py-2 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Ajouter</button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {scheduleTimes.map(t => (
                                                            <button key={`rss-${t}`} onClick={() => removeScheduleTime(t)} className="px-2 py-1 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">{t} ✕</button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {daemonKey === 'elections' && (
                                        <div className="space-y-2 p-3 border-2 border-stone-900 bg-stone-50">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase">Intervalle Elections</span>
                                                <Toggle checked={electionsIntervalEnabled} onChange={setElectionsIntervalEnabled} />
                                            </div>
                                            {electionsIntervalEnabled && (
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Scan toutes les x heures</label>
                                                    <input type="number" step="0.1" value={daemonProfiles.elections.election_interval_hours} onChange={e => updateDaemonProfile('elections', 'election_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-black uppercase">Heures fixes Elections</span>
                                                <Toggle checked={electionsScheduleEnabled} onChange={setElectionsScheduleEnabled} />
                                            </div>
                                            {electionsScheduleEnabled && (
                                                <>
                                                    <div className="flex gap-2 items-end">
                                                        <input type="time" value={newElectionScheduleTime} onChange={e => setNewElectionScheduleTime(e.target.value)} className="bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                                        <button onClick={addElectionScheduleTime} className="px-3 py-2 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">Ajouter</button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {electionsScheduleTimes.map(t => (
                                                            <button key={`elec-${t}`} onClick={() => removeElectionScheduleTime(t)} className="px-2 py-1 bg-stone-900 text-white border-2 border-stone-900 text-[10px] font-black uppercase">{t} ✕</button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Signals/Scan</label>
                                        <input type="number" value={daemonProfiles[daemonKey].max_articles} onChange={e => updateDaemonProfile(daemonKey, 'max_articles', e.target.value)} className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Lookback (h)</label>
                                        <input type="number" value={daemonProfiles[daemonKey].rss_lookback_hours} onChange={e => updateDaemonProfile(daemonKey, 'rss_lookback_hours', e.target.value)} className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Min Delay (m)</label>
                                        <input type="number" value={daemonProfiles[daemonKey].min_delay_min} onChange={e => updateDaemonProfile(daemonKey, 'min_delay_min', e.target.value)} className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Delay (m)</label>
                                        <input type="number" value={daemonProfiles[daemonKey].max_delay_min} onChange={e => updateDaemonProfile(daemonKey, 'max_delay_min', e.target.value)} className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Scan Interval (h)</label>
                                        <input type="number" step="0.1" value={daemonProfiles[daemonKey].scan_interval_hours} onChange={e => updateDaemonProfile(daemonKey, 'scan_interval_hours', e.target.value)} className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Elections Interval (h)</label>
                                        <input type="number" step="0.1" value={daemonProfiles[daemonKey].election_interval_hours} onChange={e => updateDaemonProfile(daemonKey, 'election_interval_hours', e.target.value)} className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 text-[10px] font-black uppercase text-stone-500">Les valeurs seront actives apres Enregistrer dans Runtime & Actions.</div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
