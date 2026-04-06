import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TooltipInfo } from './UIComponents';

export interface RadarPost {
  id: number;
  source_url: string;
  source_title: string;
  flash_content: string;
  image_keyword: string | null;
  geo: string | null;
  tags: string | null;
  type_ouverture: string | null;
  fiabilite: string | null;
  video_path: string | null;
  created_at: string;
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
    const isIgnored = activeTab === 'IGNORED';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
        >
            {/* Card Header */}
            <div className="px-5 py-3.5 flex items-center gap-3 border-b border-stone-100">
                {onToggleSelect && (
                    <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={(e) => onToggleSelect(post.id, e.target.checked)}
                        className="w-4 h-4 rounded border-stone-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                    />
                )}
                <span className="text-xs font-semibold text-rose-500 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-100">
                    Flash IA
                </span>
                {post.fiabilite && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                        post.fiabilite === 'haute' ? 'bg-green-50 text-green-700 border-green-100' :
                        post.fiabilite === 'suspecte' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                        'bg-amber-50 text-amber-700 border-amber-100'
                    }`}>
                        {post.fiabilite.toUpperCase()}
                    </span>
                )}
                {post.type_ouverture && (
                    <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest truncate max-w-[150px]">
                        {post.type_ouverture}
                    </span>
                )}
                <div className="flex-1 min-w-0">
                    {isPending ? (
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full text-sm font-semibold text-stone-800 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-stone-400"
                            placeholder="Titre de la source…"
                        />
                    ) : (
                        <span className="text-sm font-semibold text-stone-700 truncate block">{title}</span>
                    )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <time className="text-xs text-stone-400">{new Date(post.created_at).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</time>
                    <a href={post.source_url} target="_blank" rel="noreferrer" className="text-xs text-sky-500 hover:text-sky-600 font-medium transition-colors">
                        Source ↗
                    </a>
                    <button onClick={() => setExpanded(e => !e)} className="text-stone-400 hover:text-stone-600 transition-colors text-sm">
                        {expanded ? '▲' : '▼'}
                    </button>
                </div>
            </div>

            {/* Card Body */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                    >
                        <div className="px-5 py-4">
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                disabled={!isPending}
                                rows={6}
                                className={`w-full text-sm leading-relaxed text-stone-700 rounded-xl border resize-y focus:outline-none transition-colors p-3.5 ${isPending
                                    ? 'border-stone-200 hover:border-stone-300 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 bg-stone-50'
                                    : 'border-transparent bg-transparent opacity-80 cursor-default'
                                    }`}
                            />

                            {/* Image */}
                            {isPending && (
                                <div className="mt-3">
                                    <label className="text-xs font-medium text-stone-500 block mb-1.5">Image attachée (URL)</label>
                                    <input
                                        type="text"
                                        value={imageUrl}
                                        onChange={e => setImageUrl(e.target.value)}
                                        placeholder="https://… (laisser vide si aucune)"
                                        className="w-full text-sm border border-stone-200 rounded-xl px-3.5 py-2 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 transition-colors placeholder:text-stone-300"
                                    />
                                    {imageUrl && imageUrl.startsWith('http') && (
                                        <img src={imageUrl} alt="Preview" className="mt-2 w-32 h-20 object-cover rounded-lg border border-stone-200" />
                                    )}
                                </div>
                            )}
                             {!isPending && imageUrl && imageUrl.startsWith('http') && (
                                <img src={imageUrl} alt="Image" className="mt-2 w-32 h-20 object-cover rounded-lg border border-stone-200 opacity-80" />
                            )}

                            {post.video_path && (
                                <div className="mt-4 border-2 border-stone-900 rounded-2xl overflow-hidden bg-black shadow-lg">
                                    <div className="px-3 py-1.5 bg-stone-900 flex items-center justify-between">
                                        <span className="text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                            🎬 PIÈCE JOINTE VIDÉO (OSINT)
                                        </span>
                                    </div>
                                    <video 
                                        controls 
                                        className="w-full aspect-video"
                                        src={`/api/radar/video?path=${encodeURIComponent(post.video_path)}`}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Tags */}
                        {(post as any).tags && (post as any).tags.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5">
                                {((post as any).tags as string).split(',').filter(Boolean).map((t: string) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10px] font-medium border border-stone-200">
                                        #{t.trim()}
                                    </span>
                                ))}
                                {(post as any).geo && (
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${(post as any).geo === 'france'
                                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                        }`}>
                                        {(post as any).geo === 'france' ? '🇫🇷 France' : '🌍 International'}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Actions */}
                        <div className={`px-5 py-3.5 flex items-center justify-between border-t border-stone-100 ${isPending ? 'bg-stone-50' : 'bg-transparent'}`}>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                                activeTab === 'PUBLISHED' ? 'text-green-600 bg-green-50 border border-green-100' : 
                                activeTab === 'APPROVED' ? 'text-amber-600 bg-amber-50 border border-amber-100' : 
                                activeTab === 'REJECTED' ? 'text-stone-400 bg-stone-100' : 
                                activeTab === 'IGNORED' ? 'text-stone-500 bg-stone-100 border border-stone-200' : ''
                            }`}>
                                {activeTab === 'PUBLISHED' ? '✓ Publié' : activeTab === 'APPROVED' ? '🕒 En file' : activeTab === 'REJECTED' ? 'Rejeté' : activeTab === 'IGNORED' ? '📦 Archive (Annexe)' : ''}
                            </span>

                            {isPending && (
                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex items-center gap-1">
                                        <button
                                            onClick={() => window.open(`/radar-admin/studio?id=${post.id}`, '_blank')}
                                            disabled={isSaving}
                                            className="px-3 py-2 text-xs font-semibold rounded-xl bg-gradient-to-r from-fuchsia-500 via-rose-500 to-orange-400 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                                        >
                                            📸 Studio Insta
                                        </button>
                                        <TooltipInfo text="Ouvre ce flash dans un studio dédié pour générer automatiquement une image et une caption optimisés au format Instagram." position="top" />
                                    </div>
                                    <div className="relative flex items-center gap-1 ml-1.5">
                                        <button
                                            onClick={() => handleAction('REJECTED')}
                                            disabled={isSaving}
                                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-stone-200 bg-white text-stone-500 hover:text-stone-700 hover:border-stone-300 transition-colors disabled:opacity-50"
                                        >
                                            Rejeter
                                        </button>
                                        <TooltipInfo text="Jette cet article définitivement. Il ne sera pas publié et ne sera plus reproposé." position="top" />
                                    </div>
                                    <div className="relative flex items-center gap-1 ml-1.5">
                                        <button
                                            onClick={() => handleAction('APPROVED')}
                                            disabled={isSaving}
                                            className="px-3 py-2 text-xs font-semibold rounded-xl border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                        >
                                            🕒 File d'attente
                                        </button>
                                        <TooltipInfo text="Valide cet article. Il partira en file d'attente et sera publié de manière invisible par le Pilote Auto avec un décalage aléatoire (pour passer l'anti-bot)." position="top" />
                                    </div>
                                    <div className="relative flex items-center gap-1 ml-1.5">
                                        <button
                                            onClick={() => handleAction('PUBLISHED')}
                                            disabled={isSaving}
                                            className="px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm hover:shadow-rose-200 disabled:opacity-50"
                                        >
                                            {isSaving ? 'Envoi…' : '⚡ Publier'}
                                        </button>
                                        <TooltipInfo text="Publie IMMÉDIATEMENT cet article sur WordPress. Ignore le délai de publication aléatoire." position="top" />
                                    </div>

                                    <div className="relative flex items-center gap-1 ml-3 px-3 border-l border-stone-200">
                                        <button
                                            onClick={() => handleAction('IGNORED')}
                                            disabled={isSaving}
                                            className="p-2 text-stone-400 hover:text-stone-700 transition-colors"
                                        >
                                            📦
                                        </button>
                                        <TooltipInfo text="Mettre en Annexe (Archiver)" position="top" />
                                    </div>
                                </div>
                            )}

                            {isIgnored && (
                                <button
                                    onClick={() => handleAction('PENDING')}
                                    disabled={isSaving}
                                    className="px-3 py-2 text-xs font-semibold rounded-xl border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
                                >
                                    📥 Restaurer vers "À modérer"
                                </button>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
