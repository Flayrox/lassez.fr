'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';

interface CommunicationLayerProps {
    config: {
        maintenance_mode: boolean;
        maintenance_message: string;
        popup_enabled: boolean;
        popup_title: string;
        popup_text: string;
        popup_link_url: string;
        popup_link_label: string;
    };
}

export default function CommunicationLayer({ config }: CommunicationLayerProps) {
    const pathname = usePathname();
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        // Logique de la Pop-up
        if (config.popup_enabled) {
            const hasSeenPopup = sessionStorage.getItem('lassez_popup_seen');
            if (!hasSeenPopup) {
                // On attend 2 secondes avant d'afficher la pop-up pour laisser le site charger
                const timer = setTimeout(() => setShowPopup(true), 2000);
                return () => clearTimeout(timer);
            }
        }
    }, [config.popup_enabled]);

    const closePopup = () => {
        setShowPopup(false);
        sessionStorage.setItem('lassez_popup_seen', 'true');
    };

    // Ne pas afficher la maintenance sur les pages admin (pour pouvoir désactiver le mode !)
    const isAdminPage = pathname?.startsWith('/radar-admin') || pathname?.startsWith('/radar-login');

    return (
        <>
            {/* 🛠 MODE MAINTENANCE */}
            <AnimatePresence>
                {config.maintenance_mode && !isAdminPage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[9999] bg-stone-50 flex flex-col items-center justify-center p-6 text-center"
                    >
                        <div className="max-w-md space-y-6">
                            <div className="w-20 h-20 bg-rose-600 rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-8">
                                <span className="text-4xl text-white font-black italic">!</span>
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tighter text-stone-900 leading-tight">
                                Maintenance en cours
                            </h1>
                            <p className="text-stone-500 font-medium leading-relaxed">
                                {config.maintenance_message || "L'Assez revient très bientôt."}
                            </p>
                            <div className="pt-8 flex flex-col items-center gap-4">
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-rose-600 animate-bounce" style={{ animationDelay: '0ms' }} />
                                    <div className="w-2 h-2 rounded-full bg-rose-600 animate-bounce" style={{ animationDelay: '150ms' }} />
                                    <div className="w-2 h-2 rounded-full bg-rose-600 animate-bounce" style={{ animationDelay: '300ms' }} />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-stone-300">
                                    Radar Pilot System — Standby
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ✨ POP-UP PROMO / INFO */}
            <AnimatePresence>
                {showPopup && !config.maintenance_mode && (
                    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="bg-white border-4 border-stone-900 rounded-3xl p-8 max-w-sm w-full shadow-[12px_12px_0px_0px_rgba(28,25,23,1)] relative"
                        >
                            <button 
                                onClick={closePopup}
                                className="absolute top-4 right-4 text-stone-400 hover:text-stone-900 transition-colors font-bold text-xl"
                            >
                                ✕
                            </button>
                            
                            <div className="space-y-5">
                                <span className="inline-block px-3 py-1 bg-sky-100 text-sky-600 font-black uppercase tracking-widest text-[10px] rounded-full">
                                    Message Important
                                </span>
                                <h2 className="text-2xl font-black uppercase tracking-tighter italic text-stone-900 leading-tight">
                                    {config.popup_title}
                                </h2>
                                <p className="text-stone-600 text-sm leading-relaxed font-medium">
                                    {config.popup_text}
                                </p>
                                <div className="pt-4 flex flex-col gap-3">
                                    <a 
                                        href={config.popup_link_url}
                                        onClick={closePopup}
                                        className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white font-black uppercase tracking-widest rounded-xl text-center border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(28,25,23,1)] transition-all active:translate-y-1 active:shadow-none"
                                    >
                                        {config.popup_link_label}
                                    </a >
                                    <button 
                                        onClick={closePopup}
                                        className="w-full py-2 text-stone-400 hover:text-stone-600 transition-colors text-[10px] font-black uppercase tracking-widest"
                                    >
                                        Fermer pour le moment
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
