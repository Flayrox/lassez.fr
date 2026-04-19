'use client';

import React, { useState, useEffect } from 'react';
import { WPPost } from '../types';
import Link from 'next/link';
import { ChevronLeftIcon } from './icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getArticleUrl } from '../lib/getArticleUrl';

interface HeroCarouselProps {
    posts: WPPost[];
}

export default function HeroCarousel({ posts }: HeroCarouselProps) {
    const totalSlides = posts.length + 1; // +1 for the Comprendre CTA slide
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [progress, setProgress] = useState(0);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        setProgress(0);
    }, [currentIndex]);

    useEffect(() => {
        if (totalSlides <= 1) return;
        if (isHovered) {
            setProgress(p => p > 80 ? 0 : p);
            return;
        }
        const interval = setInterval(() => {
            setProgress(prev => {
                const next = prev + (50 / 6000) * 100;
                if (next >= 100) {
                    goTo((currentIndex + 1) % totalSlides);
                    return 0;
                }
                return next;
            });
        }, 50);
        return () => clearInterval(interval);
    }, [totalSlides, isHovered, currentIndex]);

    if (!posts || posts.length === 0) return null;

    const goTo = (idx: number) => {
        if (isAnimating) return;
        setIsAnimating(true);
        setCurrentIndex(idx);
        setTimeout(() => setIsAnimating(false), 600);
    };

    const handleNext = () => goTo((currentIndex + 1) % totalSlides);
    const handlePrev = () => goTo((currentIndex - 1 + totalSlides) % totalSlides);

    return (
        <div className="w-full relative">
            <div
                className="relative w-full min-h-[380px] sm:min-h-[400px] md:min-h-0 aspect-[4/5] sm:aspect-video md:aspect-[21/9] lg:h-[450px] bg-ink overflow-visible z-10 shadow-hard-xl"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
            >
                {/* À LA UNE badge */}
                <div className="absolute top-0 left-0 -translate-y-1/2 z-40 flex items-center gap-3 bg-lassez-red text-paper px-4 py-2 font-mono font-black text-xs uppercase tracking-widest shadow-hard-sm pointer-events-none">
                    <span className="w-1.5 h-1.5 bg-paper rounded-full shrink-0 animate-pulse"></span>
                    <span>À LA UNE</span>
                </div>

                {/* ── Inner clip: images + arrows + timer only, NO text overlays ── */}
                <div className="absolute inset-0 overflow-hidden">

                    {/* Slide strip */}
                    <div
                        className="absolute inset-0 flex"
                        style={{
                            width: `${totalSlides * 100}%`,
                            transform: `translateX(-${(currentIndex * 100) / totalSlides}%)`,
                            transition: isAnimating ? 'transform 600ms cubic-bezier(0.77, 0, 0.175, 1)' : 'none',
                        }}
                    >
                        {/* Article images + gradients */}
                        {posts.map((post, idx) => {
                            const imgUrl = (typeof post.featuredImage === 'object' && post.featuredImage?.url) ? post.featuredImage.url : `https://picsum.photos/seed/${post.id}/1200/800`;
                            const isActive = idx === currentIndex;
                            return (
                                <div
                                    key={`hero-img-${post.id}`}
                                    className="relative shrink-0 h-full"
                                    style={{ width: `${100 / totalSlides}%` }}
                                >
                                    <img
                                        src={imgUrl}
                                        alt={post.title}
                                        className={`absolute inset-0 w-full h-full object-cover transition-transform duration-[10s] ease-out ${isActive ? 'scale-[1.04]' : 'scale-100'}`}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-br from-black/5 via-transparent to-black/50 pointer-events-none" />
                                    {/* Yellow hover flash — pointer-events-none so link still works */}
                                    <div className="absolute inset-0 bg-yellow-400/0 hover:bg-yellow-400/10 transition-colors duration-300 pointer-events-none" />
                                </div>
                            );
                        })}

                        {/* Comprendre slide image layer */}
                        <div
                            key="comprendre-img"
                            className="relative shrink-0 h-full bg-ink overflow-hidden"
                            style={{ width: `${100 / totalSlides}%` }}
                        >
                            <div className="absolute -top-20 -right-20 w-96 h-96 border-[40px] border-lassez-red/20 rotate-12" />
                            <div className="absolute top-1/2 -left-10 w-64 h-64 border-[30px] border-yellow-400/10 -rotate-6" />
                            <div className="absolute bottom-0 right-1/3 w-40 h-full bg-white/[0.02]" />
                            <div className="absolute inset-0" style={{
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 40px, rgba(255,255,255,0.02) 40px, rgba(255,255,255,0.02) 41px)'
                            }} />
                        </div>
                    </div>

                    {/* Navigation Arrows */}
                    <button
                        onClick={(e) => { e.preventDefault(); handlePrev(); }}
                        className="absolute left-0 top-1/2 -translate-y-1/2 bg-paper text-ink p-2 md:p-3 hover:bg-lassez-red hover:text-paper transition-all duration-200 z-30 opacity-70 hover:opacity-100 shadow-hard-sm"
                        aria-label="Précédent"
                    >
                        <ChevronLeftIcon className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                    <button
                        onClick={(e) => { e.preventDefault(); handleNext(); }}
                        className="absolute right-0 top-1/2 -translate-y-1/2 bg-paper text-ink p-2 md:p-3 hover:bg-lassez-red hover:text-paper transition-all duration-200 z-30 opacity-70 hover:opacity-100 shadow-hard-sm rotate-180"
                        aria-label="Suivant"
                    >
                        <ChevronLeftIcon className="w-5 h-5 md:w-6 md:h-6" />
                    </button>

                    {/* Timer bar */}
                    <div className="absolute bottom-0 left-0 right-0 z-30 h-1.5 md:h-2 bg-paper/20">
                        <div
                            className="absolute top-0 left-0 h-full bg-lassez-red transition-all duration-75 ease-linear shadow-[0_0_10px_rgba(255,0,0,0.5)]"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>{/* end inner clip */}

                {/* ── Text overlays: OUTSIDE inner clip, inside overflow:visible parent ──
                    This means box-decoration-clone is NEVER clipped by overflow:hidden     */}

                {/* Article text overlays */}
                {posts.map((post, idx) => {
                    const categories = Array.isArray(post.categories) ? post.categories.filter((cat): cat is any => typeof cat === 'object') : [];
                    const isActive = idx === currentIndex;
                    return (
                        <Link
                            key={`hero-text-${post.id}`}
                            href={getArticleUrl(post)}
                            className={`absolute inset-0 z-20 focus:outline-none group/card ${isActive ? 'pointer-events-auto' : 'pointer-events-none'}`}
                            tabIndex={isActive ? 0 : -1}
                            aria-hidden={!isActive}
                        >
                            {/* Text block — bottom right */}
                            <div className={`absolute bottom-3 right-3 sm:bottom-4 sm:right-4 md:bottom-6 md:right-6 lg:bottom-8 lg:right-8 max-w-[90%] sm:max-w-[80%] md:max-w-xl flex flex-col items-end drop-shadow-[5px_5px_0px_rgba(0,0,0,1)] transition-all duration-500 delay-100 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>

                                {/* Title with per-line background — works because we're outside overflow:hidden */}
                                <h2 className="text-right" style={{ lineHeight: '1.65', display: 'block', wordBreak: 'break-word' }}>
                                    <span
                                        className="font-serif font-black text-lg sm:text-xl md:text-3xl lg:text-[2rem] uppercase tracking-tight text-ink bg-paper group-hover/card:bg-yellow-100 transition-colors duration-300 px-2 py-[2px] sm:px-3 sm:py-[3px] md:px-4 md:py-[3px] box-decoration-clone"
                                    >
                                        <span dangerouslySetInnerHTML={{ __html: post.title }} />
                                    </span>
                                </h2>

                                {/* Separator */}
                                <div className="w-full h-[3px] bg-ink" />

                                {/* Category & Date */}
                                <div className="flex font-mono text-[8px] sm:text-[10px] md:text-xs items-end justify-end">
                                    {categories.length > 0 && (
                                        <span className="bg-paper text-ink px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 inline-flex items-center font-black uppercase group-hover/card:bg-yellow-100 transition-colors duration-300">
                                            {categories[0].name}
                                        </span>
                                    )}
                                    <span className="bg-ink text-paper px-2 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 inline-flex items-center font-bold tracking-widest uppercase">
                                        {format(new Date(post.publishedAt || post.createdAt), 'dd.MM.yyyy', { locale: fr })}
                                    </span>
                                </div>
                            </div>

                            {/* Lire l'article — bottom-left */}
                            <div className={`absolute bottom-3 left-3 sm:bottom-4 sm:left-4 md:bottom-6 md:left-6 lg:bottom-8 lg:left-8 transition-all duration-500 delay-200 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'}`}>
                                <span className="flex items-center gap-1 sm:gap-2 bg-paper/90 text-ink px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 md:py-2.5 font-mono font-black text-[9px] sm:text-[10px] md:text-xs uppercase tracking-widest border-2 border-ink shadow-hard-sm group-hover/card:bg-yellow-100 transition-colors duration-200">
                                    <span className="text-lassez-red">→</span>
                                    Lire l&apos;article
                                </span>
                            </div>
                        </Link>
                    );
                })}

                {/* Comprendre CTA overlay */}
                {(() => {
                    const isActive = currentIndex === posts.length;
                    return (
                        <Link
                            href="/comprendre"
                            className={`absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-8 md:p-12 lg:p-16 group/cta focus:outline-none ${isActive ? 'pointer-events-auto' : 'pointer-events-none'}`}
                            tabIndex={isActive ? 0 : -1}
                            aria-hidden={!isActive}
                        >
                            {/* Top label */}
                            <div className={`transition-all duration-500 delay-100 ${isActive ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
                                <div className="inline-flex items-center gap-2 sm:gap-3 bg-yellow-400 text-ink px-3 py-1.5 sm:px-4 sm:py-2 font-mono font-black text-[9px] sm:text-xs uppercase tracking-widest shadow-hard-sm">
                                    <span>◈</span>
                                    <span>Comprendre</span>
                                </div>
                            </div>

                            {/* Main text */}
                            <div className={`transition-all duration-500 delay-150 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} flex-1 flex flex-col justify-center mt-4 sm:mt-0`}>
                                <p className="font-mono text-paper text-[9px] sm:text-xs uppercase tracking-[0.2em] mb-2 sm:mb-4 opacity-70">
                                    Le monde est complexe.
                                </p>
                                <h2 className="font-serif font-black text-paper uppercase text-2xl sm:text-4xl md:text-5xl lg:text-6xl leading-[0.95] tracking-tighter mb-3 sm:mb-5 max-w-xl">
                                    Com<span className="text-yellow-400">prendre</span><br />
                                    le système.
                                </h2>
                                <p className="font-sans text-paper text-xs sm:text-sm md:text-base leading-relaxed max-w-lg opacity-80 border-l-2 sm:border-l-4 border-yellow-400 pl-3 sm:pl-4 line-clamp-3 sm:line-clamp-none">
                                    Fisc, lobbies, dette... nos dossiers pédagogiques pour comprendre les rouages du pouvoir.
                                </p>
                            </div>

                            {/* CTA button */}
                            <div className={`transition-all duration-500 delay-200 ${isActive ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'} mb-2 sm:mb-0`}>
                                <div className="inline-flex items-center gap-2 sm:gap-3 bg-yellow-400 text-ink px-4 py-2 sm:px-6 sm:py-3 font-mono font-black text-[10px] sm:text-sm uppercase tracking-widest shadow-hard group-hover/cta:shadow-none group-hover/cta:translate-x-1 group-hover/cta:translate-y-1 transition-all duration-200 border-2 border-ink">
                                    <span>Accéder aux dossiers</span>
                                    <span>→</span>
                                </div>
                            </div>
                        </Link>
                    );
                })()}

            </div>
        </div>
    );
}
