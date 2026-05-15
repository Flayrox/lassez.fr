'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ModernRadarTableProps {
    posts: any[];
    loading: boolean;
    onUpdate: (id: string, status: string) => void;
    activeTab: string;
    selectedIds: string[];
    onToggleSelect: (id: string, selected: boolean) => void;
    onToggleAll: (selected: boolean) => void;
    onRowClick?: (post: any) => void;
}

export function ModernRadarTable({ 
    posts, 
    loading, 
    onUpdate, 
    activeTab, 
    selectedIds, 
    onToggleSelect,
    onToggleAll,
    onRowClick
}: ModernRadarTableProps) {
    const isLab = activeTab === 'LAB';
    const isReview = activeTab === 'REVIEW';
    const isQueue = activeTab === 'QUEUE';
    
    const allSelected = posts.length > 0 && selectedIds.length === posts.length;

    if (loading) {
        return (
            <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
                <div className="w-5 h-5 border-2 border-slate-200 border-t-black rounded-full animate-spin"></div>
                <p className="text-[10px] font-medium font-mono">Syncing neural feed...</p>
            </div>
        );
    }

    if (posts.length === 0) {
        return (
            <div className="py-20 text-center border border-dashed border-slate-200 rounded-sm bg-slate-50/50">
                <p className="text-[11px] font-medium text-slate-400 font-mono italic">No signals in this sector.</p>
            </div>
        );
    }

    return (
        <div className="border border-slate-200 rounded-sm overflow-hidden bg-white shadow-sm">
            <table className="w-full text-left border-collapse table-fixed">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 font-medium">
                        <th className="w-10 px-4 py-2 text-center">
                            <input 
                                type="checkbox" 
                                checked={allSelected}
                                onChange={(e) => onToggleAll(e.target.checked)}
                                className="w-3.5 h-3.5 rounded-sm border-slate-300 text-black focus:ring-black cursor-pointer"
                            />
                        </th>
                        <th className="w-[45%] px-4 py-2">Signal / Content</th>
                        <th className="w-[15%] px-4 py-2">Source</th>
                        <th className="w-[15%] px-4 py-2">Timeline</th>
                        <th className="px-4 py-2 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px]">
                    {posts.map(post => (
                        <tr 
                            key={post.id} 
                            onClick={() => onRowClick && onRowClick(post)}
                            className={`group hover:bg-slate-50/50 transition-colors cursor-pointer ${selectedIds.includes(post.id) ? 'bg-slate-50/80' : ''}`}
                        >
                            <td className="px-4 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                <input 
                                    type="checkbox" 
                                    checked={selectedIds.includes(post.id)}
                                    onChange={(e) => onToggleSelect(post.id, e.target.checked)}
                                    className="w-3.5 h-3.5 rounded-sm border-slate-300 text-black focus:ring-black cursor-pointer"
                                />
                            </td>
                            <td className="px-4 py-2">
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-900 truncate">{post.source_title}</span>
                                        {post.type_ouverture && (
                                            <span className="text-[9px] font-bold text-slate-400 border border-slate-100 px-1 rounded-sm uppercase tracking-tighter">
                                                {post.type_ouverture.replace(/[^\w\s]/gi, '').trim()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-slate-500 line-clamp-1 group-hover:line-clamp-2 transition-all leading-tight">
                                        {post.flash_content}
                                    </p>
                                    <div className="flex gap-1 mt-1">
                                        {post.tags && post.tags.split(',').slice(0, 3).map((tag: string, i: number) => (
                                            <span key={i} className="text-[9px] text-slate-400 font-mono">#{tag.trim()}</span>
                                        ))}
                                    </div>
                                </div>
                            </td>
                            <td className="px-4 py-2">
                                <div className="flex flex-col">
                                    <span className="font-medium text-slate-600 truncate">{post.source_name || 'OSINT'}</span>
                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{post.geo_focus || 'Global'}</span>
                                </div>
                            </td>
                            <td className="px-4 py-2 font-mono text-[10px] text-slate-500">
                                {isQueue && post.scheduled_at ? (
                                    <div className="flex flex-col">
                                        <span className="text-emerald-600 font-bold">Scheduled</span>
                                        <span>{new Date(post.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col">
                                        <span>{new Date(post.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
                                        <span>{new Date(post.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {isReview && (
                                        <>
                                            <button 
                                                onClick={() => onUpdate(post.id, 'QUEUED')}
                                                className="w-7 h-7 flex items-center justify-center bg-black text-white rounded-sm hover:bg-zinc-800 transition-all"
                                                title="Approve & Queue"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">check</span>
                                            </button>
                                            <button 
                                                onClick={() => onUpdate(post.id, 'REJECTED')}
                                                className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-sm hover:text-rose-500 hover:border-rose-200 transition-all"
                                                title="Reject"
                                            >
                                                <span className="material-symbols-outlined text-[16px]">close</span>
                                            </button>
                                        </>
                                    )}
                                    {isQueue && (
                                        <button 
                                            onClick={() => onUpdate(post.id, 'PUBLISHED')}
                                            className="h-7 px-3 bg-black text-white rounded-sm text-[10px] font-bold hover:bg-zinc-800 transition-all"
                                        >
                                            Publish
                                        </button>
                                    )}
                                    {isLab && (
                                        <button 
                                            onClick={() => onUpdate(post.id, 'REJECTED')}
                                            className="w-7 h-7 flex items-center justify-center bg-white border border-slate-200 text-slate-400 rounded-sm hover:text-rose-500 hover:border-rose-200 transition-all"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
