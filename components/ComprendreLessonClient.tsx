'use client';

import React, { useRef, useState, useEffect } from 'react';
import { WPPost, WPTerm } from '../types';
import Link from 'next/link';
import ReadingProgress from './ReadingProgress';
import { useProgress } from '../hooks/useProgress';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { SaveIcon } from './icons';

interface Props {
    post: WPPost;
    livePreviewServerURL?: string;
    isPreview?: boolean;
}

function getRenderedField(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object' && 'rendered' in value) {
        const rendered = (value as { rendered?: unknown }).rendered;
        return typeof rendered === 'string' ? rendered : '';
    }
    return '';
}

const ComprendreLessonClient: React.FC<Props> = ({ post: initialPost, livePreviewServerURL, isPreview = false }) => {
    const articleRef = useRef<HTMLElement>(null);
    const progress = useProgress();

    const [post, setPost] = useState<WPPost>(initialPost as any);

    useEffect(() => {
        if (!isPreview) return;

        const handleMessage = (event: MessageEvent) => {
            if (event.data && event.data.type === 'payload-live-preview') {
                if (event.data.data) {
                    setPost((prev) => ({ ...prev, ...event.data.data }));
                }
            }
        };

        window.addEventListener('message', handleMessage);

        const parent = window.opener || window.parent;
        if (parent && parent !== window) {
            parent.postMessage({ type: 'payload-live-preview', ready: true }, '*');
        }

        return () => window.removeEventListener('message', handleMessage);
    }, [isPreview]);

    // Safety check just in case
    const categories: WPTerm[] = (post as any)?._embedded?.['wp:term']?.[0] || [];
    const isCompleted = progress.isCompleted(post.id);
    const titleHtml = getRenderedField((post as any).title);
    const excerptHtml = getRenderedField((post as any).excerpt);
    const contentHtml = getRenderedField((post as any).content);

    const handleMarkAsCompleted = () => {
        progress.markAsCompleted(post.id);
    };

    const handleSaveAsPdf = () => {
        if (articleRef.current) {
            html2canvas(articleRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#FBF9F4' }).then(canvas => {
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, canvas.height * 210 / canvas.width);
                pdf.save(`FICHE_REVISION_${post.slug}.pdf`);
            }).catch(() => { });
        }
    };

    return (
        <div className="max-w-3xl mx-auto relative pb-20 bg-paper min-h-screen font-serif text-ink">
            {isPreview && (
                <div className="sticky top-2 z-50 mx-4 md:mx-0 mb-4 flex justify-center">
                    <div className="inline-flex items-center gap-2 rounded-full border-2 border-amber-300 bg-amber-300 px-3 py-1 font-mono text-[10px] font-black uppercase tracking-widest text-black shadow-hard-sm">
                        <span>Preview brouillon</span>
                        <span className="opacity-70">Comprendre</span>
                    </div>
                </div>
            )}

            <ReadingProgress />

            {/* Barre de navigation minimaliste */}
            <nav className="flex justify-between items-center py-6 px-4 md:px-0 border-b-2 border-ink/10 mb-12">
                <Link href="/comprendre" className="group flex items-center gap-3 text-ink hover:text-lassez-red transition-colors">
                    <span className="font-mono font-bold">←</span>
                    <span className="font-mono text-xs uppercase tracking-widest font-black">Retour au cursus</span>
                </Link>
                <button
                    onClick={handleSaveAsPdf}
                    className="flex items-center gap-2 text-ink/50 hover:text-ink transition-colors font-mono text-[10px] uppercase tracking-widest"
                >
                    <SaveIcon className="w-3 h-3" />
                    <span className="hidden sm:inline">Télécharger la fiche (PDF)</span>
                </button>
            </nav>

            <article ref={articleRef} className="px-4 md:px-0">
                <header className="mb-16 md:text-center flex flex-col items-start md:items-center">
                    <div className="inline-block border-2 border-ink px-4 py-1 mb-6 shadow-hard-sm bg-white">
                        <span className="font-mono text-[10px] uppercase tracking-widest text-lassez-red font-black">
                            Leçon N°{post.acf?.lecon_comprendre || "?"}
                        </span>
                    </div>
                    <h1
                        className="font-black text-3xl sm:text-4xl md:text-5xl uppercase tracking-tighter leading-none text-ink mb-6"
                        dangerouslySetInnerHTML={{ __html: titleHtml }}
                    />
                    <div className="h-1 w-12 bg-lassez-red mb-6" />

                    {/* Excerpt intro */}
                    <div
                        className="text-lg md:text-xl text-ink/70 italic leading-relaxed max-w-2xl text-left md:text-center"
                        dangerouslySetInnerHTML={{ __html: excerptHtml }}
                    />
                </header>

                <div className="prose prose-neutral prose-lg max-w-none text-ink prose-p:leading-relaxed prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tighter prose-a:text-lassez-red prose-a:underline prose-a:decoration-2 prose-a:underline-offset-4 hover:prose-a:text-ink">
                    <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
                </div>

                <div className="mt-20 pt-10 border-t-8 border-ink">
                    <div className="p-8 border-4 border-ink bg-paper-bright flex flex-col items-center justify-center text-center space-y-6 shadow-hard-xl relative overflow-hidden">
                        {/* Decorative background lines */}
                        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '10px 10px' }}></div>

                        <div className="relative z-10 w-full flex flex-col items-center">
                            <div className="font-black uppercase text-2xl tracking-tighter text-ink">
                                Validation des Connaissances
                            </div>
                            <p className="font-serif text-sm text-ink/80 mt-2 mb-6">
                                Avez-vous assimilé les concepts présentés dans cette fiche ?
                            </p>

                            {isCompleted ? (
                                <div className="px-6 py-4 bg-green-50 text-green-700 border-2 border-green-600 font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 w-full sm:w-auto shadow-[4px_4px_0px_#16a34a]">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                    Compétence Acquise
                                </div>
                            ) : (
                                <button
                                    onClick={handleMarkAsCompleted}
                                    className="group w-full sm:w-auto px-8 py-4 bg-ink text-paper font-black uppercase tracking-widest text-sm border-2 border-ink hover:bg-lassez-red hover:border-lassez-red transition-all flex items-center justify-center gap-3 shadow-[6px_6px_0px_#FF0000] active:translate-y-1 active:translate-x-1 active:shadow-none"
                                >
                                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    J'ai compris (Passer à la suite)
                                </button>
                            )}

                            <Link href="/comprendre" className="inline-block mt-8 text-[10px] font-mono uppercase tracking-widest underline decoration-ink/20 hover:decoration-lassez-red underline-offset-4 text-ink/70 hover:text-ink transition-colors">
                                Retourner à l'arbre des compétences
                            </Link>
                        </div>
                    </div>
                </div>
            </article>
        </div>
    );
};

export default ComprendreLessonClient;
