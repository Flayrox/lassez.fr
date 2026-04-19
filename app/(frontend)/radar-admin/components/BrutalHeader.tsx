'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { LiveLogsPanel } from './LiveLogsPanel';
import { usePathname } from 'next/navigation';

interface BrutalHeaderProps {
    title?: string;
    subtitle?: string;
    isDaemonRunning?: boolean;
}

export function BrutalHeader({ 
    title = "RADAR L'ASSEZ", 
    subtitle = "Intelligence OSINT & sociale v3.0", 
    isDaemonRunning = true 
}: BrutalHeaderProps) {
    const pathname = usePathname();
    const [logsOpen, setLogsOpen] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSaveState, setSettingsSaveState] = useState<'clean' | 'dirty' | 'saving' | 'saved'>('clean');

    React.useEffect(() => {
        const onMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;
            const data = event.data;
            if (!data || data.type !== 'radar-settings-status') return;
            if (['clean', 'dirty', 'saving', 'saved'].includes(data.status)) {
                setSettingsSaveState(data.status);
            }
        };

        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    const isRadarActive = pathname === '/radar-admin';
    const isDaemonActive = pathname.startsWith('/radar-admin/daemon');
    const isSettingsActive = pathname.startsWith('/radar-admin/settings');

    return (
        <>
            <header className="flex justify-between items-center w-full px-4 md:px-8 py-4 md:py-6 sticky top-0 z-40 bg-stone-50 border-b-4 border-stone-900 font-label gap-3">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-stone-900 leading-none font-headline">{title}</h1>
                        <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mt-1">{subtitle}</p>
                    </div>
                    {isDaemonRunning && (
                        <div className="flex items-center gap-2 bg-stone-900 text-white px-3 py-1 brutal-border shadow-[2px_2px_0px_0px_#bc0100]">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-tighter">Daemon actif</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-6">
                    <div className="hidden md:flex items-center gap-6 mr-4 lg:mr-8">
                        <Link href="/radar-admin" className={`font-bold pb-1 text-sm uppercase border-b-4 ${isRadarActive ? 'text-red-700 border-red-700' : 'text-stone-600 border-transparent hover:text-stone-900'}`}>Radar</Link>
                        <Link href="/radar-admin/daemon" className={`font-bold pb-1 text-sm uppercase border-b-4 ${isDaemonActive ? 'text-red-700 border-red-700' : 'text-stone-600 border-transparent hover:text-stone-900'}`}>Daemon</Link>
                        <Link href="/radar-admin/settings" className={`font-bold pb-1 text-sm uppercase border-b-4 ${isSettingsActive ? 'text-red-700 border-red-700' : 'text-stone-600 border-transparent hover:text-stone-900'}`}>Paramètres</Link>
                    </div>
                    <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-end">
                        <button className="bg-red-700 text-white px-3 md:px-4 py-2 brutal-border font-bold text-[10px] md:text-xs uppercase tracking-widest brutal-shadow hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all">
                            Publier tout
                        </button>
                        {pathname !== '/radar-admin/settings' && (
                            <button
                                onClick={() => {
                                    setSettingsSaveState('clean');
                                    setSettingsOpen(true);
                                }}
                                className="bg-stone-900 text-white px-3 md:px-4 py-2 brutal-border font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-stone-700 transition-all"
                            >
                                Parametres rapides
                            </button>
                        )}
                        <button
                            onClick={() => setLogsOpen(true)}
                            className="bg-white text-stone-900 px-3 md:px-4 py-2 brutal-border font-bold text-[10px] md:text-xs uppercase tracking-widest hover:bg-stone-200 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">terminal</span>
                            Logs live
                        </button>
                    </div>
                </div>
            </header>

            {logsOpen && (
                <div className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4">
                    <div className="w-full max-w-6xl bg-stone-50 border-4 border-stone-900 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] max-h-[92vh] overflow-hidden">
                        <div className="px-5 py-4 border-b-4 border-stone-900 flex items-center justify-between bg-white">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-tight">Journal live daemon</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Même flux que le Research Lab</p>
                            </div>
                            <button
                                onClick={() => setLogsOpen(false)}
                                className="px-3 py-2 bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest border-2 border-stone-900"
                            >
                                Fermer
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto max-h-[80vh]">
                            <LiveLogsPanel compact />
                        </div>
                    </div>
                </div>
            )}

            {settingsOpen && (
                <div className="fixed inset-0 z-[130] bg-black/75 flex items-center justify-center p-0 md:p-4">
                    <div className="w-full h-full md:h-[92vh] md:max-w-[96vw] bg-stone-50 border-0 md:border-4 border-stone-900 shadow-none md:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                        <div className="px-3 md:px-5 py-3 md:py-4 border-b-4 border-stone-900 flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-white">
                            <div>
                                <h3 className="text-base md:text-lg font-black uppercase tracking-tight">Parametres rapides</h3>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Configuration sans quitter la page courante</p>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest border-2 ${settingsSaveState === 'dirty' ? 'bg-amber-100 text-amber-900 border-amber-500' : settingsSaveState === 'saving' ? 'bg-sky-100 text-sky-900 border-sky-500' : settingsSaveState === 'saved' ? 'bg-emerald-100 text-emerald-900 border-emerald-500' : 'bg-stone-100 text-stone-700 border-stone-400'}`}>
                                    {settingsSaveState === 'dirty' ? 'Modifs non enregistrees' : settingsSaveState === 'saving' ? 'Enregistrement...' : settingsSaveState === 'saved' ? 'Enregistre' : 'A jour'}
                                </span>
                                <Link
                                    href="/radar-admin/settings"
                                    className="px-3 py-2 bg-stone-200 text-stone-900 text-[10px] font-black uppercase tracking-widest border-2 border-stone-900"
                                >
                                    Ouvrir en plein ecran
                                </Link>
                                <button
                                    onClick={() => setSettingsOpen(false)}
                                    className="px-3 py-2 bg-stone-900 text-white text-[10px] font-black uppercase tracking-widest border-2 border-stone-900"
                                >
                                    Fermer
                                </button>
                            </div>
                        </div>
                        <iframe
                            src="/radar-admin/settings?overlay=1"
                            title="Parametres rapides"
                            className="w-full h-[calc(100vh-112px)] md:h-[calc(92vh-72px)] bg-white"
                        />
                    </div>
                </div>
            )}
        </>
    );
}
