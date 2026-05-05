'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MODEL_OPTIONS = ['gemini-2.0-flash', 'gemini-2.0-pro-exp', 'gemini-1.5-pro', 'gemini-1.5-flash'];

interface FlowSidebarProps {
    editingNode: any;
    onClose: () => void;
    editValues: Record<string, any>;
    setEditValues: (vals: Record<string, any>) => void;
    onSave: () => Promise<void>;
    onDelete: (id: string) => void;
    isSaving: boolean;
}

export function FlowSidebar({ editingNode, onClose, editValues, setEditValues, onSave, onDelete, isSaving }: FlowSidebarProps) {
    if (!editingNode) return null;

    return (
        <>
            <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                onClick={onClose} 
                className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] z-[60]" 
            />
            <motion.div 
                initial={{ x: '100%' }} 
                animate={{ x: 0 }} 
                exit={{ x: '100%' }} 
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="absolute right-0 top-0 bottom-0 w-[400px] bg-white border-l border-slate-200 z-[70] shadow-2xl p-8 flex flex-col"
            >
                <div className="flex items-center justify-between mb-10">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl ${editingNode.bg} flex items-center justify-center shadow-inner`}>
                            <span className={`material-symbols-outlined text-xl ${editingNode.color}`}>{editingNode.icon}</span>
                        </div>
                        <div>
                            <h3 className="text-lg font-bold uppercase tracking-tight text-slate-900 leading-none mb-1">{editingNode.label}</h3>
                            <p className="text-xs font-medium text-slate-400">{editingNode.description}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-slate-400">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
                    {editingNode.type === 'source' ? (
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Resource Endpoints</label>
                            <textarea 
                                value={editValues[editingNode.settingKey]} 
                                onChange={(e) => setEditValues({...editValues, [editingNode.settingKey]: e.target.value})} 
                                className="w-full h-[500px] bg-slate-50 border border-slate-200 rounded-2xl p-6 font-mono text-xs focus:ring-4 focus:ring-blue-100 focus:border-blue-300 outline-none resize-none transition-all" 
                                placeholder="https://..."
                            />
                        </div>
                    ) : (
                        editingNode.settings?.map((key: string) => (
                            <div key={key} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{key.replace(/_/g, ' ')}</label>
                                    {key.includes('threshold') && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-[10px] font-black">{Math.round(parseFloat(editValues[key] || '0') * 100)}%</span>}
                                </div>
                                
                                {key.includes('model') ? (
                                    <select 
                                        value={editValues[key]} 
                                        onChange={(e) => setEditValues({...editValues, [key]: e.target.value})} 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold focus:ring-4 focus:ring-blue-100 outline-none"
                                    >
                                        {MODEL_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                ) : (key.includes('enabled') || key.includes('approve') || key.includes('pilot')) ? (
                                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                                        <span className="text-xs font-bold text-slate-600">Active Status</span>
                                        <button 
                                            onClick={() => setEditValues({...editValues, [key]: editValues[key] === 'true' ? 'false' : 'true'})} 
                                            className={`w-12 h-6 rounded-full transition-all relative ${editValues[key] === 'true' ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                        >
                                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${editValues[key] === 'true' ? 'left-7' : 'left-1'}`} />
                                        </button>
                                    </div>
                                ) : (key.includes('prompt') || key.includes('json')) ? (
                                    <textarea 
                                        value={editValues[key]} 
                                        onChange={(e) => setEditValues({...editValues, [key]: e.target.value})} 
                                        rows={8} 
                                        className="w-full bg-white border border-slate-200 rounded-xl p-4 font-mono text-xs focus:ring-4 focus:ring-blue-100 outline-none resize-none" 
                                    />
                                ) : key.includes('threshold') ? (
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.05" 
                                        value={editValues[key]} 
                                        onChange={(e) => setEditValues({...editValues, [key]: e.target.value})} 
                                        className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" 
                                    />
                                ) : (
                                    <input 
                                        type="text" 
                                        value={editValues[key]} 
                                        onChange={(e) => setEditValues({...editValues, [key]: e.target.value})} 
                                        className="w-full bg-white border border-slate-200 rounded-xl px-5 py-3 text-xs font-bold focus:ring-4 focus:ring-blue-100 outline-none" 
                                    />
                                )}
                            </div>
                        ))
                    )}
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100 space-y-3">
                    <button 
                        onClick={onSave} 
                        disabled={isSaving} 
                        className="w-full py-4 rounded-2xl bg-black text-white text-[11px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                        {isSaving ? (
                            <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> SYNCING...</>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[18px]">sync_alt</span>
                                SYNC TO CORTEX
                            </>
                        )}
                    </button>

                    <button 
                        onClick={() => {
                            if(confirm('Supprimer ce nœud et ses connexions ?')) {
                                onDelete(editingNode.id);
                            }
                        }}
                        className="w-full py-3 rounded-2xl border border-red-100 text-red-500 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 transition-all flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        Remove Node
                    </button>
                </div>
            </motion.div>
        </>
    );
}
