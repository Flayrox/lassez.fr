'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { XIcon } from './icons';
import { useSidebarMode } from '../hooks/useSidebarMode';
import EnqueteSidebar from './sidebar/EnqueteSidebar';
import RevelationsSidebar from './sidebar/RevelationsSidebar';
import ElectionsSidebar from './sidebar/ElectionsSidebar';
import DefaultSidebar from './sidebar/DefaultSidebar';

interface SidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    hideOnDesktop?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setIsOpen, hideOnDesktop = false }) => {
    const mode = useSidebarMode();
    const [connId, setConnId] = useState('SYSTEM');

    useEffect(() => {
        setConnId(Math.random().toString(36).substr(2, 6).toUpperCase());
    }, []);

    const closeMenu = () => setIsOpen(false);

    const renderContent = () => {
        switch (mode) {
            case 'enquetes':
                return <EnqueteSidebar onClose={closeMenu} />;
            case 'revelations':
                return <RevelationsSidebar onClose={closeMenu} />;
            case 'elections':
                return <ElectionsSidebar onClose={closeMenu} />;
            default:
                return <DefaultSidebar onClose={closeMenu} />;
        }
    };

    return (
        <>
            {/* Overlay - Faster fade on mobile */}
            {isOpen && (
                <div
                    onClick={closeMenu}
                    className="fixed inset-0 bg-ink/80 z-[60] backdrop-blur-md lg:hidden transition-opacity duration-200"
                ></div>
            )}

            <aside className={`
                fixed ${hideOnDesktop ? 'lg:hidden' : 'lg:sticky'} top-0 lg:top-[120px] left-0 
                h-full lg:h-[calc(100vh-140px)]
                w-[85vw] max-w-[320px]
                bg-paper border-r-4 border-lassez-border lg:border-none 
                z-[70] lg:z-0 
                transform ${isOpen ? 'translate-x-0 shadow-[8px_0px_0px_0px_#FF0000] lg:shadow-none' : '-translate-x-[110%] shadow-none opacity-0 lg:opacity-100'} lg:translate-x-0 
                transition-all duration-300 ease-in-out 
                flex flex-col
                lg:shrink-0
                paper-texture
            `}>
                <div className="flex flex-col h-full lg:border-4 lg:border-ink lg:bg-paper-bright relative overflow-hidden">

                    {/* Decorative Dossier Tab (Desktop) */}
                    <div className="hidden lg:block absolute -top-3 left-4 bg-ink text-paper px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-widest z-10">
                        CONFIDENTIEL // NIV. 4
                    </div>

                    {/* Mobile Header Menu */}
                    <div className="flex justify-between items-center p-6 border-b-4 border-lassez-border bg-ink text-paper lg:hidden">
                        <div className="flex flex-col">
                            <h2 className="font-mono font-bold uppercase tracking-widest text-xs">ARCHIVES_CENTRALES</h2>
                            <span className="text-[8px] opacity-50 font-mono uppercase">Version_Système_3.1</span>
                        </div>
                        <button
                            onClick={closeMenu}
                            className="p-2 border-2 border-paper hover:bg-lassez-red active:scale-90 transition-all shadow-hard-sm"
                            aria-label="Fermer"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content Area */}
                    {renderContent()}

                    {/* Sidebar Footer */}
                    <div className="p-4 border-t-4 border-ink bg-marker-yellow/20">
                        <Link
                            href="/soutenir"
                            onClick={closeMenu}
                            className="block bg-lassez-red text-ink font-black text-center py-3 uppercase text-xs border-2 border-ink shadow-hard-sm hover:translate-y-1 hover:shadow-none transition-all group relative overflow-hidden"
                        >
                            <span className="relative z-10">Soutenir l'indépendance</span>
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500"></div>
                        </Link>
                        <p className="text-[9px] font-mono text-center uppercase mt-3 opacity-60 text-ink">
                            Connexion sécurisée<br />ID: {connId}
                        </p>
                    </div>
                </div>
            </aside>
        </>
    );
};

export default Sidebar;
