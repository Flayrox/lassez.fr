'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const sidebarLinks = [
    { name: 'Radar', icon: 'radar', href: '/radar-admin', activePattern: /^\/radar-admin(\/)?$/ },
    { name: 'Daemon', icon: 'memory', href: '/radar-admin/daemon', activePattern: /^\/radar-admin\/daemon/ },
    { name: 'Studio', icon: 'settings_input_component', href: '/radar-admin/studio', activePattern: /^\/radar-admin\/studio/ },
    { name: 'Network', icon: 'hub', href: '/radar-admin/network', activePattern: /^\/radar-admin\/network/ },
    { name: 'Lab', icon: 'terminal', href: '/radar-admin/lab', activePattern: /^\/radar-admin\/lab/ },
    { name: 'Settings', icon: 'settings', href: '/radar-admin/settings', activePattern: /^\/radar-admin\/settings/ },
    { name: 'Users', icon: 'manage_accounts', href: '/radar-admin/users', activePattern: /^\/radar-admin\/users/ },
];

export function BrutalSidebar() {
    const pathname = usePathname();
    const [isScanning, setIsScanning] = React.useState(false);

    const handleManualScan = async () => {
        setIsScanning(true);
        try {
            // Lancer le processus en arrière plan
            const response = await fetch('/api/radar/trigger', { method: 'POST' });
            if (!response.ok) {
                alert("Erreur lors du lancement du scan.");
            } else {
                // Optionnel: on peut écouter le stream ici ou juste notifier que c'est lancé
                alert("Scan manuel lancé ! Rendez-vous sur la Console pour suivre la progression en direct.");
            }
        } catch (e) {
            console.error(e);
            alert("Erreur réseau au lancement du scan.");
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <aside className="w-64 h-screen border-r-4 border-stone-900 flex flex-col sticky top-0 left-0 bg-stone-50 z-50 font-label">
            <div className="p-6">
                <div className="text-3xl font-black tracking-tighter text-stone-900 mb-1 font-headline">L&apos;ASSEZ</div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-stone-500">Terminal Admin</div>
            </div>

            <nav className="flex-1 px-4 space-y-4">
                {sidebarLinks.map((link) => {
                    const isActive = link.activePattern.test(pathname);
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={`flex items-center gap-3 px-4 py-3 border-4 transition-all duration-100 ${
                                isActive
                                    ? 'bg-red-700 text-white border-stone-900 shadow-[4px_4px_0px_0px_rgba(26,28,28,1)]'
                                    : 'text-stone-600 border-transparent hover:text-stone-900 hover:translate-x-[-2px] hover:translate-y-[-2px]'
                            }`}
                        >
                            <span className="material-symbols-outlined">{link.icon}</span>
                            <span className="font-bold uppercase text-sm tracking-tight">{link.name}</span>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto">
                <button 
                    onClick={handleManualScan}
                    disabled={isScanning}
                    className={`w-full text-white font-bold py-3 border-4 border-stone-900 transition-all uppercase text-xs tracking-widest ${isScanning ? 'bg-stone-500 cursor-wait' : 'bg-stone-900 shadow-[4px_4px_0px_0px_rgba(26,28,28,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-0 active:translate-y-0 active:shadow-none'}`}
                >
                    {isScanning ? 'Lancement...' : 'Manual Scan'}
                </button>
                <div className="mt-8 border-t-4 border-stone-900 pt-4 pb-2">
                    <Link
                        href="/"
                        className="flex items-center gap-3 px-4 py-2 text-stone-600 hover:text-red-700 transition-colors font-bold uppercase text-xs"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        Logout
                    </Link>
                </div>
            </div>
        </aside>
    );
}
