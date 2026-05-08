'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ModernRadarCardProps {
    post: any;
    onUpdate: (id: string, status: string) => void;
    activeTab: string;
    isSelected: boolean;
    onToggleSelect: (id: string, selected: boolean) => void;
}

export function ModernRadarCard({ post, onUpdate, activeTab, isSelected, onToggleSelect }: ModernRadarCardProps) {
    const isLab = activeTab === 'LAB';
    const isReview = activeTab === 'REVIEW';
    const isQueue = activeTab === 'QUEUE';
    const isDone = activeTab === 'DONE';

    const statusColors: Record<string, string> = {
        '🔴 ALERTE INFO !': 'text-red-600 bg-red-50 border-red-100',
        '🚨 ALERTE GÉNÉRALE !': 'text-red-700 bg-red-50 border-red-200',
        '📌 LE FAIT DU JOUR': 'text-blue-600 bg-blue-50 border-blue-100',
        '🔎 DÉCRYPTAGE': 'text-purple-600 bg-purple-50 border-purple-100',
        '🧠 ENQUÊTE': 'text-purple-700 bg-purple-50 border-purple-200',
        '⚡️ CITATION': 'text-amber-600 bg-amber-50 border-amber-100',
        '🚨 FLASH': 'text-orange-600 bg-orange-50 border-orange-100',
    };

    const typeColor = statusColors[post.type_ouverture] || 'text-slate-600 bg-slate-50 border-slate-100';

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`group relative bg-white rounded-xl border transition-all ${
                isSelected ? 'border-black ring-4 ring-slate-50' : 'border-slate-200 hover:border-slate-300 shadow-sm'
            }`}
        >
            <div className="flex">
                {/* Selection Checkbox */}
                <div className="p-4 border-r border-slate-100 flex flex-col items-center gap-4">
                    <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => onToggleSelect(post.id, e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-black focus:ring-black cursor-pointer"
                    />
                    <div className="text-[9px] font-bold text-slate-300 vertical-text uppercase tracking-widest opacity-40">
                        {post.id.slice(0, 8)}
                    </div>
                </div>

                <div className="flex-1 p-5">
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border ${typeColor}`}>
                                {post.type_ouverture || 'INFO'}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                {isQueue && post.scheduled_at ? (
                                    <span className="text-emerald-600">📅 Prévu à : {new Date(post.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                ) : (
                                    <>Reçu à : {new Date(post.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</>
                                )} • {post.status}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            {isLab && (
                                <button 
                                    onClick={() => onUpdate(post.id, 'REJECTED')}
                                    className="h-8 px-3 rounded-md bg-white border border-slate-200 text-slate-600 text-[10px] font-bold uppercase tracking-widest hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
                                >
                                    Discard
                                </button>
                            )}
                            {isReview && (
                                <>
                                    <button 
                                        onClick={() => onUpdate(post.id, 'QUEUED')}
                                        className="h-8 px-3 rounded-md bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-600 shadow-sm transition-all flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-sm">schedule_send</span>
                                        Approve & Queue
                                    </button>
                                    <button 
                                        onClick={() => onUpdate(post.id, 'REJECTED')}
                                        className="h-8 px-3 rounded-md bg-white border border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 hover:text-slate-600 transition-all"
                                    >
                                        Reject
                                    </button>
                                </>
                            )}
                            {isQueue && (
                                <button 
                                    onClick={() => onUpdate(post.id, 'PUBLISHED')}
                                    className="h-8 px-3 rounded-md bg-black text-white text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                                >
                                    Publish Now
                                </button>
                            )}
                        </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-2 leading-snug">
                        {post.source_title}
                    </h3>
                    
                    <p className="text-sm text-slate-600 leading-relaxed mb-4 whitespace-pre-wrap line-clamp-3 group-hover:line-clamp-none transition-all">
                        {post.flash_content}
                    </p>

                    <div className="flex flex-wrap gap-2">
                        {post.tags && post.tags.split(',').map((tag: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-medium">
                                #{tag.trim()}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Media Preview if any */}
                {post.image_keyword && (
                    <div className="w-48 bg-slate-50 border-l border-slate-100 relative overflow-hidden group-hover:w-64 transition-all duration-300">
                        {/* Placeholder for now */}
                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                            <span className="material-symbols-outlined text-4xl">image</span>
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent"></div>
                        <div className="absolute bottom-3 left-3 right-3 text-[10px] font-bold text-white uppercase tracking-widest truncate">
                            {post.image_keyword}
                        </div>
                    </div>
                )}
            </div>
        </motion.div>
    );
}
