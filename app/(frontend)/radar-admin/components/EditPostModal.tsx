'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EditPostModalProps {
    isOpen: boolean;
    post: any | null;
    onClose: () => void;
    onSave: (id: string, data: any) => Promise<void>;
}

export function EditPostModal({ isOpen, post, onClose, onSave }: EditPostModalProps) {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState('');
    const [imageKeyword, setImageKeyword] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (post) {
            setTitle(post.source_title || '');
            setContent(post.flash_content || '');
            setTags(post.tags || '');
            setImageKeyword(post.image_keyword || '');
        }
    }, [post]);

    if (!isOpen || !post) return null;

    const handleSave = async () => {
        setSaving(true);
        try {
            await onSave(post.id, {
                source_title: title,
                flash_content: content,
                tags: tags.split(',').map(t => t.trim()).filter(Boolean),
                image_keyword: imageKeyword
            });
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />
                
                <motion.div 
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative bg-white rounded-md shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[20px] text-slate-700">edit_document</span>
                            <h2 className="text-[14px] font-bold text-slate-900">Edit Signal</h2>
                        </div>
                        <button 
                            onClick={onClose}
                            className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-6 overflow-y-auto space-y-4">
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Title (Headline)</label>
                            <input 
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[13px] font-medium text-slate-900 focus:outline-none focus:border-black transition-colors"
                            />
                        </div>
                        
                        <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Content (Flash)</label>
                            <textarea 
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                rows={5}
                                className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[12px] text-slate-700 focus:outline-none focus:border-black transition-colors resize-none"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Tags (comma separated)</label>
                                <input 
                                    type="text"
                                    value={tags}
                                    onChange={e => setTags(e.target.value)}
                                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[12px] font-mono text-slate-700 focus:outline-none focus:border-black transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Image Keyword</label>
                                <input 
                                    type="text"
                                    value={imageKeyword}
                                    onChange={e => setImageKeyword(e.target.value)}
                                    placeholder="e.g. cyber, technology, politics"
                                    className="w-full bg-white border border-slate-200 rounded-sm px-3 py-2 text-[12px] font-mono text-slate-700 focus:outline-none focus:border-black transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
                        <button 
                            onClick={onClose}
                            className="px-4 py-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-2 bg-black text-white text-[11px] font-bold rounded-sm hover:bg-zinc-800 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {saving ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Saving...
                                </>
                            ) : (
                                'Save Changes'
                            )}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
