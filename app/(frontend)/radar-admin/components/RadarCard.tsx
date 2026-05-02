'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface RadarPost {
  id: number;
  source_url: string;
  source_title: string;
  flash_content: string;
  image_keyword: string | null;
  geo: 'france' | 'international' | string | null;
  tags: string | null;
  type_ouverture: string | null;
  fiabilite: string | null;
  video_path: string | null;
  created_at: string;
    scheduled_at?: string | null;
}

export function RadarCard({ post, onUpdate, activeTab, isSelected, onToggleSelect }: {
    post: RadarPost;
    onUpdate: (id: number, status: 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'IGNORED' | 'PENDING', content?: string, imageUrl?: string, title?: string) => void;
    activeTab: string;
    isSelected?: boolean;
    onToggleSelect?: (id: number, selected: boolean) => void;
}) {
    const [title, setTitle] = useState(post.source_title);
    const [content, setContent] = useState(post.flash_content);
    const [imageUrl, setImageUrl] = useState(post.image_keyword || '');
    const [isSaving, setIsSaving] = useState(false);
    const [expanded, setExpanded] = useState(true);

    const handleAction = async (status: 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'IGNORED' | 'PENDING') => {
        setIsSaving(true);
        await onUpdate(post.id, status, content, imageUrl, title);
        setIsSaving(false);
    };

    const isPending = activeTab === 'PENDING';

    return (
        <motion.div
            layout
            className={`bg-white border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] overflow-hidden transition-all font-label ${isSelected ? 'translate-x-2 translate-y-2 shadow-none border-red-700' : ''}`}
        >
            {/* Card Header */}
            <div className="px-6 py-3 border-b-4 border-stone-900 flex items-center justify-between bg-stone-50">
                <div className="flex items-center gap-4">
                    {onToggleSelect && (
                        <button 
                            onClick={() => onToggleSelect(post.id, !isSelected)}
                            className={`w-6 h-6 border-4 border-stone-900 flex items-center justify-center transition-colors ${isSelected ? 'bg-red-700' : 'bg-white'}`}
                        >
                            {isSelected && <span className="material-symbols-outlined text-white text-sm">check</span>}
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-tighter bg-stone-900 text-white px-2 py-0.5">SIGNAL_ID: {post.id}</span>
                        {post.type_ouverture && (
                            <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 border-2 border-stone-900 ${
                                post.type_ouverture.includes('ALERTE') ? 'bg-red-600 text-white border-red-800' :
                                post.type_ouverture.includes('DÉCRYPTAGE') ? 'bg-indigo-600 text-white border-indigo-800' :
                                post.type_ouverture.includes('VENIR') ? 'bg-amber-500 text-black border-amber-700' :
                                'bg-stone-200 text-stone-900'
                            }`}>
                                {post.type_ouverture.replace(/['"]/g, '')}
                            </span>
                        )}
                        <span className={`text-[10px] font-black uppercase tracking-tighter px-2 py-0.5 border-2 border-stone-900 ${
                            post.geo === 'france' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                            {post.geo === 'france' ? '🇫🇷 FRANCE' : '🌍 INTL'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <time className="text-[10px] font-bold text-stone-500 uppercase">
                        {new Date(post.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </time>
                    <button onClick={() => setExpanded(!expanded)} className="material-symbols-outlined text-stone-900 hover:text-red-700">
                        {expanded ? 'expand_less' : 'expand_more'}
                    </button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row">
                {/* Main Content Area */}
                <div className="flex-1 p-6 border-r-0 md:border-r-4 border-stone-900">
                    <div className="mb-4">
                        {isPending ? (
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full text-2xl font-headline font-black text-stone-900 bg-stone-50 border-4 border-stone-900 p-3 focus:outline-none focus:bg-white transition-all uppercase italic tracking-tighter"
                                placeholder="EDITORIAL HEADLINE..."
                            />
                        ) : (
                            <h2 className="text-2xl font-headline font-black text-stone-900 uppercase italic tracking-tighter leading-none mb-1">{title}</h2>
                        )}
                        <div className="flex gap-2 mt-2">
                            {post.tags && post.tags.split(',').map(tag => (
                                <span key={tag} className="text-[9px] font-black uppercase tracking-widest text-red-700">#{tag.trim()}</span>
                            ))}
                        </div>
                    </div>

                    <AnimatePresence>
                        {expanded && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <textarea
                                    value={content}
                                    onChange={e => setContent(e.target.value)}
                                    disabled={!isPending}
                                    rows={5}
                                    className={`w-full font-body text-sm leading-relaxed p-4 border-4 border-stone-900 transition-all ${
                                        isPending ? 'bg-white focus:shadow-[4px_4px_0px_0px_#bc0100]' : 'bg-stone-50 border-stone-200'
                                    }`}
                                />

                                {isPending && (
                                    <div className="mt-4">
                                        <input
                                            type="text"
                                            value={imageUrl}
                                            onChange={e => setImageUrl(e.target.value)}
                                            placeholder="IMAGE_URL_OR_KEYWORDS..."
                                            className="w-full bg-stone-100 border-4 border-stone-900 p-3 text-[10px] font-black uppercase tracking-widest focus:outline-none focus:bg-white"
                                        />
                                    </div>
                                )}

                                {imageUrl && (
                                    <div className="mt-4 border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] max-w-md">
                                        <img src={imageUrl} alt="Aperçu" className="w-full h-40 object-cover" />
                                    </div>
                                )}

                                {post.video_path && (
                                    <div className="mt-4 border-4 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C] bg-black max-w-md">
                                        <video controls className="w-full h-40 object-cover" src={`/api/radar/video?path=${encodeURIComponent(post.video_path)}`} />
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Sidebar inside Card (Actions & Info) */}
                <div className="w-full md:w-64 bg-stone-50 flex flex-col">
                    <div className="p-6 flex-1 border-b-4 border-stone-900">
                        <div className="space-y-6">
                            <div>
                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">SOURCE_ORIGIN</span>
                                <a href={post.source_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-red-700 hover:underline break-all uppercase">
                                    {(() => {
                                        try {
                                            return new URL(post.source_url).hostname;
                                        } catch (e) {
                                            return 'ORIGIN_UNKNOWN';
                                        }
                                    })()} ↗
                                </a>
                            </div>
                            <div>
                                <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">RELIABILITY</span>
                                <div className={`inline-block px-3 py-1 border-2 border-stone-900 font-black text-[10px] uppercase ${
                                    post.fiabilite === 'haute' ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
                                }`}>
                                    {post.fiabilite || 'VERIFYING'}
                                </div>
                            </div>
                            {activeTab === 'APPROVED' && (
                                <div>
                                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest block mb-2">PUBLISH TIME</span>
                                    <div className="inline-block px-3 py-1 border-2 border-stone-900 font-black text-[10px] uppercase bg-stone-900 text-white">
                                        {post.scheduled_at
                                            ? new Date(post.scheduled_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                                            : 'NON PLANIFIE'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="p-4 grid grid-cols-2 gap-2 bg-white">
                        {isPending ? (
                            <>
                                <button
                                    onClick={() => handleAction('REJECTED')}
                                    disabled={isSaving}
                                    className="col-span-1 bg-stone-100 text-stone-900 border-4 border-stone-900 py-3 font-black text-[10px] uppercase tracking-tighter hover:bg-stone-200 active:translate-y-1 transition-all"
                                >
                                    REJECT
                                </button>
                                <button
                                    onClick={() => handleAction('IGNORED')}
                                    disabled={isSaving}
                                    className="col-span-1 bg-stone-100 text-stone-900 border-4 border-stone-900 py-3 font-black text-[10px] uppercase tracking-tighter hover:bg-stone-200 active:translate-y-1 transition-all"
                                >
                                    ARCHIVE
                                </button>
                                <button
                                    onClick={() => handleAction('APPROVED')}
                                    disabled={isSaving}
                                    className="col-span-2 bg-stone-900 text-white border-4 border-stone-900 py-3 font-black text-[10px] uppercase tracking-widest shadow-[4px_4px_0px_0px_#bc0100] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                                >
                                    APPROVE SIGNAL
                                </button>
                                <button
                                    onClick={() => handleAction('PUBLISHED')}
                                    disabled={isSaving}
                                    className="col-span-2 bg-red-700 text-white border-4 border-stone-900 py-4 font-black text-xs uppercase tracking-[0.2em] shadow-[4px_4px_0px_0px_#1A1C1C] hover:bg-red-600 transition-all"
                                >
                                    PUBLISH LIVE 🚀
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={() => handleAction('PENDING')}
                                disabled={isSaving}
                                className="col-span-2 bg-stone-100 text-stone-600 border-4 border-stone-900 py-3 font-black text-[10px] uppercase tracking-widest hover:text-stone-900"
                            >
                                RESTORE SIGNAL
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
