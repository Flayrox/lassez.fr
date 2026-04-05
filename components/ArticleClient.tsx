'use client';

import React, { useEffect, useState, useRef } from 'react';
import { WPPost, WPTerm } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { ShareIcon, SaveIcon, LoaderIcon, EyeIcon, UsersIcon } from './icons';
import ArticleCard from './ArticleCard';
import KeyPoints from './KeyPoints';
import CallToActionBlock from './CallToActionBlock';
import ReadingProgress from './ReadingProgress';
import GlitchImage from './GlitchImage';
import Breadcrumb from './Breadcrumb';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ArticleClientProps {
    post: WPPost;
    relatedPosts: WPPost[];
    slug: string;
}

const ArticleClient: React.FC<ArticleClientProps> = ({ post, relatedPosts, slug }) => {
    const articleRef = useRef<HTMLElement>(null);
    const [shareFeedback, setShareFeedback] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [readerMode, setReaderMode] = useState(false);
    const [activeReaders, setActiveReaders] = useState(12);

    useEffect(() => {
        setActiveReaders(Math.floor(Math.random() * (150 - 20 + 1)) + 20);
    }, [slug]);

    const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || `https://picsum.photos/seed/${post.id}/1200/600`;
    const author = post._embedded?.author[0]?.name || "Rédaction";
    const categories: WPTerm[] = post._embedded?.['wp:term']?.[0] || [];

    const rawKeyPoints = post.acf?.key_points;
    let keyPoints: string[] = [];
    if (rawKeyPoints) {
        if (Array.isArray(rawKeyPoints)) keyPoints = rawKeyPoints;
        else if (typeof rawKeyPoints === 'string') keyPoints = rawKeyPoints.split('\n').filter(line => line.trim() !== '');
    }

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({ title: post.title.rendered, url: window.location.href });
            } else {
                await navigator.clipboard.writeText(window.location.href);
                setShareFeedback('COPIÉ');
                setTimeout(() => setShareFeedback(''), 2000);
            }
        } catch (e) { }
    };

    const handleSaveAsPdf = () => {
        if (articleRef.current) {
            setIsGeneratingPdf(true);
            html2canvas(articleRef.current, { scale: 1.5, useCORS: true, backgroundColor: '#FBF9F4' }).then(canvas => {
                const pdf = new jsPDF('p', 'mm', 'a4');
                pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, canvas.height * 210 / canvas.width);
                pdf.save(`RAPPORT_LASSEZ_${post.id}.pdf`);
                setIsGeneratingPdf(false);
            }).catch(() => setIsGeneratingPdf(false));
        }
    };

    return (
        <div className={`max-w-4xl mx-auto relative pb-8 transition-all ${readerMode ? 'bg-paper-bright' : ''}`}>

            <ReadingProgress />

            <div className="flex justify-between items-end mb-3 mt-2 px-4 md:px-0">
                <Breadcrumb items={[{ label: categories[0]?.name.toUpperCase() || 'DOSSIER', path: categories[0]?.slug && categories[0]?.slug !== 'revelations' ? `/enquetes?secteur=${categories[0].slug}` : undefined }]} />
                <div className="flex items-center gap-1.5 text-[8px] font-mono uppercase bg-ink text-paper px-2 py-1 border border-lassez-border">
                    <UsersIcon className="w-2.5 h-2.5 text-lassez-red animate-ping" />
                    <span>{activeReaders} DIRECT</span>
                </div>
            </div>

            <article
                ref={articleRef}
                className={`relative ${readerMode ? 'bg-paper-bright px-4 py-4 md:py-12' : 'bg-paper px-4 md:px-0'}`}
            >
                <header className="text-center mb-6">
                    <h1 className={`font-serif font-black text-ink leading-tight mb-4 ${readerMode ? 'text-2xl md:text-5xl' : 'text-xl sm:text-3xl md:text-6xl uppercase tracking-tighter'}`} dangerouslySetInnerHTML={{ __html: post.title.rendered }} />

                    <div className="flex justify-center items-center gap-3 py-1.5 border-y border-lassez-border font-mono text-[8px] md:text-xs uppercase">
                        <div>PAR: <span className="font-black text-lassez-red">{author.toUpperCase()}</span></div>
                        <div className="opacity-20">|</div>
                        <div>{format(new Date(post.date), 'dd.MM.yy', { locale: fr })}</div>
                    </div>
                </header>

                {!readerMode && (
                    <figure className="relative border border-lassez-border shadow-hard mb-6 overflow-hidden">
                        <GlitchImage src={imageUrl} alt={post.title.rendered} className="w-full max-h-[250px] md:max-h-[500px] object-cover filter contrast-125 saturate-50" />
                    </figure>
                )}

                <div className="flex flex-col items-center gap-6 mb-8 no-print sticky top-24 z-30">
                    <div className="flex flex-wrap justify-center gap-4">
                        <button
                            onClick={() => setReaderMode(!readerMode)}
                            className={`
                        group flex items-center gap-2 px-6 py-3 border-2 border-lassez-border shadow-hard transition-all duration-200 uppercase font-black text-xs tracking-widest
                        ${readerMode ? 'bg-ink text-paper' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper hover:shadow-hard-xl hover:-translate-y-1'}
                    `}
                        >
                            <EyeIcon className={`w-4 h-4 ${readerMode ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'}`} />
                            <span>{readerMode ? 'Mode Standard' : 'Mode Lecture'}</span>
                        </button>

                        <button
                            onClick={handleShare}
                            className="group flex items-center gap-2 px-6 py-3 border-2 border-lassez-border shadow-hard bg-paper-bright text-ink hover:bg-lassez-red hover:text-white hover:shadow-hard-xl hover:-translate-y-1 transition-all duration-200 uppercase font-black text-xs tracking-widest"
                        >
                            <ShareIcon className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                            <span>Partager</span>
                        </button>

                        <button
                            onClick={handleSaveAsPdf}
                            className="group flex items-center gap-2 px-6 py-3 border-2 border-lassez-border shadow-hard bg-paper-bright text-ink hover:bg-lassez-red hover:text-white hover:shadow-hard-xl hover:-translate-y-1 transition-all duration-200 uppercase font-black text-xs tracking-widest"
                        >
                            <SaveIcon className="w-4 h-4 group-hover:bounce transition-transform" />
                            <span>{isGeneratingPdf ? 'Génération...' : 'PDF'}</span>
                        </button>
                    </div>

                    <div className="flex flex-wrap justify-center gap-2">
                        <span className="font-mono text-[10px] uppercase opacity-50 self-center mr-2">Classé dans :</span>
                        {categories.map(cat => cat.slug === 'revelations' ? (
                            <span
                                key={cat.id}
                                className="bg-ink/5 text-ink border border-lassez-border px-3 py-1 text-[10px] font-black uppercase tracking-wider"
                            >
                                #{cat.name}
                            </span>
                        ) : (
                            <Link
                                key={cat.id}
                                href={`/enquetes?secteur=${cat.slug}`}
                                className="bg-ink/5 hover:bg-lassez-red hover:text-white text-ink border border-lassez-border px-3 py-1 text-[10px] font-black uppercase tracking-wider transition-colors"
                            >
                                #{cat.name}
                            </Link>
                        ))}
                    </div>
                </div>

                {keyPoints.length > 0 && <div className="mb-6"><KeyPoints points={keyPoints} /></div>}

                <div
                    className={`prose prose-neutral prose-sm sm:prose-base max-w-none ${readerMode ? 'prose-p:text-justify font-serif' : 'text-ink'}`}
                    dangerouslySetInnerHTML={{ __html: post.content.rendered || post.excerpt.rendered }}
                />

                <div className="mt-10 md:mt-16 pt-6 border-t-4 border-double border-lassez-border text-center font-mono text-[8px] uppercase tracking-widest text-ink/20">
                    /// TRANSMISSION TERMINÉE ///
                </div>


            </article>

            {!readerMode && (
                <div className="px-4 md:px-0 space-y-12">
                    <CallToActionBlock onShare={handleShare} />

                    <section className="no-print pb-8">
                        <div className="flex items-center gap-3 mb-6">
                            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter shrink-0 text-ink">À LIRE AUSSI</h2>
                            <div className="h-[2px] w-full bg-lassez-border opacity-20"></div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {relatedPosts && relatedPosts.length > 0 ? (
                                relatedPosts.map(p => (
                                    <ArticleCard key={p.id} post={p} />
                                ))
                            ) : (
                                <p className="col-span-full font-mono text-[10px] text-center opacity-30 uppercase">Aucun dossier connexe disponible.</p>
                            )}
                        </div>
                    </section>
                </div>
            )}

            {shareFeedback && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-lassez-red text-ink font-mono px-4 py-2 border border-lassez-border shadow-hard-sm z-[100] uppercase text-[9px] font-black animate-bounce">
                    {shareFeedback}
                </div>
            )}
        </div>
    );
};

export default ArticleClient;
