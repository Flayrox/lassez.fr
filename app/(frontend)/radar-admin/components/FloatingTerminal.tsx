'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUI } from '../context/UIContext';
import { LiveLogsPanel } from './LiveLogsPanel';

export function FloatingTerminal() {
    const { isTerminalOpen, setTerminalOpen } = useUI();

    return (
        <AnimatePresence>
            {isTerminalOpen && (
                <motion.div 
                    drag
                    dragMomentum={false}
                    initial={{ opacity: 0, scale: 0.98, x: '-50%', y: '-50%', left: '50%', top: '50%' }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="fixed z-[999] w-full max-w-4xl pointer-events-auto shadow-2xl"
                >
                    <div className="bg-white border border-slate-300 rounded-sm overflow-hidden flex flex-col">
                        {/* Payload-style Header (Compact & Functional) */}
                        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-move select-none">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px] text-black font-bold">terminal</span>
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-black">Cortex Console</span>
                                </div>
                                <div className="h-3 w-px bg-slate-300 mx-1" />
                                <span className="text-[9px] font-medium text-slate-400 font-mono">v6.1.4_STABLE</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest hidden sm:block">Moveable Frame</span>
                                <button
                                    onClick={() => setTerminalOpen(false)}
                                    className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded-sm transition-colors group"
                                >
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 group-hover:text-black">close</span>
                                </button>
                            </div>
                        </div>
                        
                        {/* Terminal Body */}
                        <div className="h-[550px] bg-white">
                            <LiveLogsPanel compact />
                        </div>

                        {/* Footer Status (Payload/Vercel Detail) */}
                        <div className="px-5 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    System Active
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                    Telemetry Synced
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-slate-300">
                                <span>Ref: 0x9012A</span>
                                <span>128-bit Encryption</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
