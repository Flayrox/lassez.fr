'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

const PIPELINE: { status: string; label: string; hint: string }[] = [
    { status: 'INGESTED', label: 'Ingéré', hint: 'Node 1-2' },
    { status: 'RESEARCHED', label: 'Analysé', hint: 'Node 3' },
    { status: 'DRAFTED', label: 'Rédigé', hint: 'Node 4' },
    { status: 'VALIDATED', label: 'Validé', hint: 'Node 5' },
    { status: 'PENDING', label: 'En attente', hint: 'Node 6' },
    { status: 'PUBLISHED', label: 'Publié', hint: 'Diffusé' },
];

const HEALTH_META: Record<string, { label: string; dot: string; text: string }> = {
    ok: { label: 'Daemon stable', dot: 'bg-green-600', text: 'text-green-700' },
    late: { label: 'Daemon en retard', dot: 'bg-amber-500', text: 'text-amber-600' },
    paused: { label: 'Autopilote off', dot: 'bg-stone-400', text: 'text-stone-500' },
};

const LEVEL_STYLE: Record<string, string> = {
    INFO: 'bg-sky-100 text-sky-700 border-sky-300',
    WARN: 'bg-amber-100 text-amber-700 border-amber-300',
    ERROR: 'bg-red-100 text-red-700 border-red-300',
    SUCCESS: 'bg-green-100 text-green-700 border-green-300',
};

const STATUS_STYLE: Record<string, string> = {
    INGESTED: 'bg-stone-100 text-stone-600 border-stone-300',
    RESEARCHED: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    DRAFTED: 'bg-violet-100 text-violet-700 border-violet-300',
    VALIDATED: 'bg-teal-100 text-teal-700 border-teal-300',
    PENDING: 'bg-amber-100 text-amber-700 border-amber-300',
    QUEUED: 'bg-pink-100 text-pink-700 border-pink-300',
    PUBLISHED: 'bg-green-100 text-green-700 border-green-300',
    REJECTED: 'bg-red-100 text-red-700 border-red-300',
    REJECTED_ERROR: 'bg-orange-100 text-orange-700 border-orange-300',
    FAILED: 'bg-red-200 text-red-800 border-red-400',
};

export default function RadarCockpitClient(props: {
    counts: Record<string, number>;
    total: number;
    lastLogAt: string | null;
    lastLogMessage: string | null;
    daemonHealth: 'ok' | 'late' | 'paused';
    autoPublish: boolean;
    aiModel: string;
    recentSignals: { id: string; title: string; status: string; updatedAt: string | null }[];
    recentLogs: { id: string; level: string; node: string; message: string; timestamp: string | null }[];
    duePubs: number;
    errors: number;
    logLevel: string;
    logRetentionDays: number;
    focusNodes: string[];
}) {
    const router = useRouter();
    const { counts, total, lastLogAt, lastLogMessage, daemonHealth, autoPublish, aiModel, recentSignals, recentLogs, duePubs, errors, logLevel, logRetentionDays, focusNodes } = props;

    const health = HEALTH_META[daemonHealth] || HEALTH_META.ok;
    const stat = (s: string) => counts[s] || 0;
    const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : 'jamais');
    const isFocusNode = (node: string) => focusNodes.length > 0 && focusNodes.some((n) => node === n || node.startsWith(n));
    const shownLogs = focusNodes.length > 0 ? recentLogs.filter((l) => isFocusNode(l.node)) : recentLogs;

    return (
        <div className="min-h-screen bg-paper text-ink paper-texture">
            {/* Barre supérieure */}
            <div className="border-b-4 border-ink bg-paper-bright sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 mr-auto">
                        <span className="w-3 h-3 bg-lassez-red rounded-full animate-pulse" />
                        <h1 className="font-black uppercase tracking-tight text-lg leading-none">
                            Radar <span className="text-lassez-red">//</span> Cockpit
                        </h1>
                        <span className="hidden sm:inline text-[9px] font-mono uppercase tracking-widest text-ink/40 border-l-2 border-lassez-border pl-3">
                            Vue d&apos;ensemble autonome
                        </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest border-2 px-2 py-1 ${health.text} ${daemonHealth === 'ok' ? 'border-green-600' : daemonHealth === 'late' ? 'border-amber-500' : 'border-stone-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${health.dot}`} /> {health.label}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-ink/50 border-2 border-lassez-border px-2 py-1">
                            Modèle : <strong className="text-ink">{aiModel}</strong>
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-widest border-2 px-2 py-1 ${autoPublish ? 'text-green-700 border-green-600' : 'text-stone-500 border-stone-400'}`}>
                            {autoPublish ? '● Autopilote actif' : '○ Autopilote off'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => router.refresh()}
                            className="text-[10px] font-black uppercase tracking-widest border-2 border-ink bg-ink text-paper px-3 py-1.5 hover:bg-lassez-red hover:border-lassez-red transition-colors"
                        >
                            ↻ Rafraîchir
                        </button>
                        <a
                            href="/admin"
                            className="text-[10px] font-black uppercase tracking-widest border-2 border-ink px-3 py-1.5 hover:bg-ink hover:text-paper transition-colors"
                        >
                            Admin →
                        </a>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
                {/* Bandeau d'état */}
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-4 border-ink bg-paper-bright px-4 py-3 shadow-hard-sm text-[11px] font-mono">
                    <span>
                        Dernier cycle : <strong>{fmt(lastLogAt)}</strong>
                    </span>
                    {lastLogMessage && <span className="text-ink/50 truncate max-w-md">{lastLogMessage.slice(0, 90)}</span>}
                    <span className="ml-auto text-ink/40 uppercase tracking-widest text-[9px]">
                        Total signals : <strong className="text-ink text-xs">{total}</strong>
                    </span>
                </div>

                {/* Pipeline */}
                <section>
                    <SectionTitle>Pipeline</SectionTitle>
                    <div className="flex items-stretch overflow-x-auto pb-2">
                        <Step label="Total" value={total} hint="signals" total />
                        {PIPELINE.map((step, i) => (
                            <React.Fragment key={step.status}>
                                {i > 0 && <span className="flex items-center px-1 text-ink/40 text-lg select-none">→</span>}
                                <Step label={step.label} value={stat(step.status)} hint={step.hint} />
                            </React.Fragment>
                        ))}
                    </div>
                </section>

                {/* Terminaux */}
                <section>
                    <div className="flex flex-wrap gap-2">
                        <Chip label="Rejetés" value={stat('REJECTED')} className="border-stone-400 text-stone-600" />
                        <Chip label="Erreurs" value={stat('REJECTED_ERROR')} className="border-orange-400 text-orange-600" />
                        <Chip label="Échecs" value={stat('FAILED')} className="border-red-400 text-red-600" />
                        {duePubs > 0 && <Chip label="Publications dues" value={duePubs} className="border-amber-500 text-amber-600 font-black" />}
                        {errors > 0 && (
                            <a href="/admin/collections/signals?where[status][in]=REJECTED_ERROR,FAILED" className="text-[10px] font-black uppercase tracking-widest border-2 border-red-500 text-red-600 px-2 py-1 hover:bg-red-500 hover:text-paper transition-colors">
                                Traiter les {errors} erreur{errors > 1 ? 's' : ''} →
                            </a>
                        )}
                    </div>
                </section>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Derniers signals */}
                    <section>
                        <SectionTitle>Derniers signals</SectionTitle>
                        <div className="border-4 border-ink bg-paper-bright shadow-hard-sm overflow-hidden">
                            {recentSignals.length === 0 ? (
                                <p className="p-4 text-xs font-mono text-ink/50">Aucun signal pour l&apos;instant — lance un scan dans l&apos;admin.</p>
                            ) : (
                                <ul className="divide-y-2 divide-lassez-border">
                                    {recentSignals.map((s) => (
                                        <li key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 border-2 shrink-0 ${STATUS_STYLE[s.status] || STATUS_STYLE.INGESTED}`}>
                                                {s.status}
                                            </span>
                                            <span className="text-xs font-bold truncate">{s.title}</span>
                                            <span className="ml-auto text-[9px] font-mono text-ink/40 shrink-0">{fmt(s.updatedAt)}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>

                    {/* Logs récents */}
                    <section>
                        <div className="flex items-center justify-between mb-2">
                            <SectionTitle noMargin>Logs récents</SectionTitle>
                            <a href="/admin/collections/logs" className="text-[9px] font-black uppercase tracking-widest text-ink/40 hover:text-lassez-red">
                                Tout voir →
                            </a>
                        </div>
                        <div className="border-4 border-ink bg-paper-bright shadow-hard-sm overflow-hidden max-h-[340px] overflow-y-auto custom-scrollbar">
                            {shownLogs.length === 0 ? (
                                <p className="p-4 text-xs font-mono text-ink/50">Aucun log pour l&apos;instant — le daemon n&apos;a pas encore tourné.</p>
                            ) : (
                                <ul className="divide-y divide-lassez-border">
                                    {shownLogs.map((l) => (
                                        <li key={l.id} className="px-4 py-2 flex items-start gap-2.5">
                                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 border-2 shrink-0 mt-0.5 ${LEVEL_STYLE[l.level] || LEVEL_STYLE.INFO}`}>
                                                {l.level}
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-mono text-ink/60">{l.node} <span className="text-ink/30">·</span> {fmt(l.timestamp)}</p>
                                                <p className="text-xs leading-snug truncate">{l.message}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                </div>

                {/* Personnalisation des logs */}
                <section className="border-4 border-ink bg-marker-yellow/20 p-4 flex flex-wrap items-center gap-3 shadow-hard-sm">
                    <div className="mr-auto">
                        <p className="font-black uppercase tracking-tight text-sm">Personnalisation des logs</p>
                        <p className="text-[10px] font-mono text-ink/50 mt-0.5">
                            Niveau actuel : <strong className="text-ink">{logLevel}</strong> · Rétention : <strong className="text-ink">{logRetentionDays > 0 ? `${logRetentionDays} jour${logRetentionDays > 1 ? 's' : ''}` : 'illimitée'}</strong>
                        </p>
                    </div>
                    <a
                        href="/admin/globals/radar-settings"
                        className="text-[10px] font-black uppercase tracking-widest border-2 border-ink bg-ink text-paper px-3 py-2 hover:bg-lassez-red hover:border-lassez-red transition-colors"
                    >
                        ⚙ Réglages Radar (onglet Logs)
                    </a>
                </section>
            </div>
        </div>
    );
}

function SectionTitle({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
    return (
        <h2 className={`font-black uppercase tracking-widest text-[10px] text-ink/60 ${noMargin ? '' : 'mb-2'}`}>
            {children}
        </h2>
    );
}

function Step({ label, value, hint, total }: { label: string; value: number; hint: string; total?: boolean }) {
    return (
        <div
            className={`flex-1 min-w-[110px] px-3.5 py-3 ${total ? 'bg-ink text-paper border-2 border-ink' : 'bg-paper-bright border-2 border-ink'}`}
        >
            <div className={`text-2xl font-black leading-none ${total ? 'text-paper' : 'text-ink'}`}>{value}</div>
            <div className={`text-[9px] font-black uppercase tracking-widest mt-1.5 ${total ? 'text-paper/70' : 'text-ink/50'}`}>{label}</div>
            <div className={`text-[9px] font-mono mt-0.5 ${total ? 'text-paper/50' : 'text-ink/30'}`}>{hint}</div>
        </div>
    );
}

function Chip({ label, value, className }: { label: string; value: number; className?: string }) {
    return (
        <span className={`inline-flex items-baseline gap-1.5 border-2 px-2 py-1 text-[10px] font-bold uppercase tracking-wide bg-paper-bright ${className || ''}`}>
            <strong className="text-sm">{value}</strong> {label}
        </span>
    );
}
