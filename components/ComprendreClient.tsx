'use client';

import React, { useState, useEffect } from 'react';
import { usePosts } from '../hooks/usePosts';
import { useCategories } from '../hooks/useCategories';
import { useProgress } from '../hooks/useProgress';
import Link from 'next/link';

const ComprendreClient: React.FC = () => {
    const { data: posts, isLoading } = usePosts('categories_exclude=1');
    const { categories } = useCategories();
    const [filter, setFilter] = useState('all');
    const [isLoaded, setIsLoaded] = useState(false);
    const [showIntroModal, setShowIntroModal] = useState(false);
    const progress = useProgress();

    useEffect(() => {
        const timer = setTimeout(() => setIsLoaded(true), 100);

        // Vérification de la popup d'introduction
        const hasSeenIntro = localStorage.getItem('lassez_comprendre_intro_seen');
        if (!hasSeenIntro) {
            // Petit délai pour laisser l'animation d'ouverture se finir
            setTimeout(() => {
                setShowIntroModal(true);
            }, 1500);
        }

        return () => clearTimeout(timer);
    }, []);

    const closeIntroModal = () => {
        localStorage.setItem('lassez_comprendre_intro_seen', 'true');
        setShowIntroModal(false);
    };

    const educationCategory = categories?.find(c => c.slug === 'comprendre' || c.name === 'Comprendre');

    const educationPosts = posts?.filter(post =>
        educationCategory ? post.categories.includes(educationCategory.id) : true
    ) || [];

    const activePosts = filter === 'all'
        ? educationPosts
        : educationPosts.filter(p => p.categories.includes(parseInt(filter)));

    const usedCategories = Array.from(new Set(educationPosts.flatMap(p => p.categories)))
        .map(id => categories?.find(c => c.id === id))
        .filter(Boolean);

    // Grouping logic based on ACF fields
    const groupedPosts = activePosts.reduce((acc, post) => {
        const chap = post.acf?.chapitre_comprendre || "Concepts Généraux";
        if (!acc[chap]) acc[chap] = [];
        acc[chap].push(post);
        return acc;
    }, {} as Record<string, typeof activePosts>);

    // Sort chapters (alphabetically for now, or you could add a sort array)
    const sortedChapters = Object.keys(groupedPosts).sort();

    // Sort posts within chapters by 'lecon_comprendre'
    Object.keys(groupedPosts).forEach(chap => {
        groupedPosts[chap].sort((a, b) => {
            const numA = a.acf?.lecon_comprendre || 999;
            const numB = b.acf?.lecon_comprendre || 999;
            return numA - numB;
        });
    });

    const completionPercentage = progress.getProgressPercentage(educationPosts.length);
    const nextArticle = progress.getNextArticle(educationPosts);

    return (
        <div className="min-h-screen bg-paper text-ink selection:bg-lassez-red selection:text-white overflow-x-hidden">
            {/* Modal d'introduction */}
            {showIntroModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-ink/80 backdrop-blur-sm transition-opacity" onClick={closeIntroModal}></div>
                    <div className="relative bg-paper-bright border-4 border-ink p-8 md:p-12 w-full max-w-2xl shadow-[12px_12px_0px_#FF0000] animate-in fade-in zoom-in duration-300">
                        <div className="inline-block border-2 border-ink px-3 py-1 mb-6 bg-white">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-lassez-red font-black">
                                /// Message Important
                            </span>
                        </div>
                        <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-[0.9] text-ink mb-6">
                            Bienvenue dans <br /> l'Auto-Défense Intellectuelle.
                        </h2>
                        <div className="space-y-4 font-serif text-lg text-ink/80 mb-10 leading-relaxed">
                            <p>
                                L'Assez a pour but premier de <strong>démystifier l'information</strong> et de rendre compréhensible par tous les systèmes qui nous entourent.
                            </p>
                            <p>
                                Ce cursus éducatif est conçu pour vous donner les clés de compréhension, afin de ne plus se laisser emporter par les prétendues « vérités » assénées par les médias traditionnels ou les discours dominants.
                            </p>
                            <p className="font-black text-ink uppercase tracking-widest text-sm pt-4 border-t-2 border-ink/10 pl-4 border-l-4 border-l-lassez-red">
                                Ne croyez rien. Comprenez tout.
                            </p>
                        </div>
                        <button
                            onClick={closeIntroModal}
                            className="w-full md:w-auto px-8 py-4 bg-ink text-paper font-black uppercase tracking-widest text-sm border-2 border-ink hover:bg-lassez-red hover:border-lassez-red transition-all flex items-center justify-center gap-3 shadow-[6px_6px_0px_#1a1a1a] hover:shadow-[6px_6px_0px_#FF0000] active:translate-y-1 active:translate-x-1 active:shadow-none"
                        >
                            J'ai compris, commencer mon apprentissage
                        </button>
                    </div>
                </div>
            )}

            <div className={`fixed inset-0 z-50 bg-paper pointer-events-none transition-transform duration-[1500ms] ease-in-out origin-left flex items-center justify-center ${isLoaded ? '-translate-x-full' : 'translate-x-0'}`}>
                <div className="text-ink font-black text-2xl uppercase tracking-widest animate-pulse">
                    Accès au cursus...
                </div>
            </div>

            <nav className={`fixed top-0 left-0 w-full z-40 p-6 md:p-8 flex justify-between items-center transition-opacity duration-1000 delay-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                <Link href="/" className="group flex items-center gap-4">
                    <div className="w-10 h-10 border-2 border-ink rounded-full flex items-center justify-center group-hover:bg-ink group-hover:text-paper transition-all">
                        <span className="font-mono font-bold text-lg">←</span>
                    </div>
                    <span className="hidden md:inline font-mono text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                        Retour Sommaire
                    </span>
                </Link>
                <div className="text-right">
                    <div className="font-black uppercase text-xl leading-none">Comprendre</div>
                    <div className="text-[10px] font-mono tracking-widest opacity-50">Parcours Éducatif</div>
                </div>
            </nav>

            {/* Progression Bar */}
            <div className={`fixed top-0 left-0 w-full h-1 bg-ink/10 z-50 transition-opacity duration-1000 delay-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                <div
                    className="h-full bg-lassez-red transition-all duration-1000 ease-out"
                    style={{ width: `${completionPercentage}%` }}
                />
            </div>

            <div className={`transition-opacity duration-1000 delay-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
                <div className="min-h-[70vh] flex flex-col justify-center items-center px-4 relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-paper-bright via-paper to-paper pointer-events-none"></div>
                    <div className="relative z-10 mb-6 opacity-30">
                        <span className="font-black text-xl md:text-2xl uppercase tracking-tighter">L'Assez<span className="text-lassez-red">.</span></span>
                    </div>
                    <h1 className="text-[12vw] md:text-[8vw] font-black tracking-tighter uppercase leading-[0.8] mb-8 text-center relative z-10 select-none">
                        Com<span className="outline-text text-transparent">prendre</span><span className="text-lassez-red">.</span>
                    </h1>
                    <div className="max-w-xl text-center relative z-10 space-y-6">
                        <p className="font-serif text-2xl md:text-3xl text-ink/70 italic">"L'éducation est l'arme la plus puissante."</p>
                        <p className="font-mono text-xs uppercase tracking-widest text-lassez-red">— Nelson Mandela</p>
                    </div>

                    {/* Next Action / Progress Stats */}
                    <div className="mt-12 text-center relative z-10 space-y-4">
                        <div className="font-mono text-xs uppercase tracking-widest text-ink/50">
                            Progression : <span className="text-ink font-black border-b-2 border-lassez-red">{completionPercentage}%</span> du corpus assimilé
                        </div>
                        {nextArticle && progress.completedArticles.length > 0 && (
                            <Link href={`/comprendre/${nextArticle.slug}`} className="inline-block px-6 py-3 border-2 border-lassez-red bg-lassez-red text-white font-black uppercase text-sm tracking-widest hover:bg-ink hover:border-ink transition-colors shadow-hard">
                                Reprendre <br className="md:hidden" />l'apprentissage ➔
                            </Link>
                        )}
                        {progress.completedArticles.length === educationPosts.length && educationPosts.length > 0 && (
                            <div className="inline-block px-6 py-3 border-2 border-green-600 bg-green-500/10 text-green-700 font-black uppercase text-sm tracking-widest shadow-[4px_4px_0px_#16a34a]">
                                Savoir Intégralement Assimilé
                            </div>
                        )}
                    </div>


                </div>

                <div className="container mx-auto px-4 pb-32">
                    {isLoading ? (
                        <div className="flex justify-center py-20">
                            <div className="w-16 h-16 border-4 border-ink/10 border-t-lassez-red rounded-full animate-spin"></div>
                        </div>
                    ) : educationPosts.length === 0 ? (
                        <div className="border-2 border-ink p-20 text-center bg-paper-bright">
                            <h3 className="font-black text-3xl uppercase mb-4 text-ink">Corpus Vide</h3>
                            <p className="font-serif text-ink/60 text-lg">La documentation est en cours de création...</p>
                        </div>
                    ) : (
                        <div className="space-y-32 relative">
                            {/* Central timeline line */}
                            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-ink -translate-x-1/2 hidden md:block"></div>

                            {sortedChapters.map((chapterName, chapIdx) => (
                                <div key={chapterName} className="relative z-10">

                                    {/* Chapter Header */}
                                    <div className="sticky top-24 z-20 mb-12 md:text-center flex md:justify-center">
                                        <div className="bg-paper-bright border-4 border-ink px-6 py-3 inline-block shadow-[8px_8px_0px_#FF0000]">
                                            <span className="font-mono text-[10px] uppercase tracking-widest text-ink/70 block mb-1">Module {chapIdx + 1}</span>
                                            <h2 className="font-black text-2xl md:text-3xl uppercase tracking-tighter text-ink">{chapterName}</h2>
                                        </div>
                                    </div>

                                    {/* Chapter Posts */}
                                    <div className="space-y-12 md:space-y-24">
                                        {groupedPosts[chapterName].map((post, index) => {
                                            const cat = categories?.find(c => post.categories.includes(c.id));
                                            const isCompleted = progress.isCompleted(post.id);

                                            // Alternate sides for timeline look on desktop
                                            const isEven = index % 2 === 0;

                                            return (
                                                <div key={post.id} className={`flex flex-col md:flex-row items-center justify-between gap-8 md:gap-16 w-full ${isEven ? 'md:flex-row' : 'md:flex-row-reverse'}`}>

                                                    {/* Card Side */}
                                                    <div className={`w-full md:w-[45%] flex ${isEven ? 'md:justify-end' : 'md:justify-start'}`}>
                                                        <Link href={`/comprendre/${post.slug}`} className={`block w-full max-w-lg p-6 md:p-10 transition-all duration-300 relative border-2 ${isCompleted ? 'bg-paper-bright border-green-600 hover:border-green-500 shadow-[6px_6px_0px_#16a34a]' : 'bg-paper-bright border-ink hover:border-ink hover:bg-paper group hover:shadow-hard'}`}>
                                                            {isCompleted && (
                                                                <div className="absolute -top-3 -right-3 w-8 h-8 bg-paper-bright border-2 border-green-600 rounded-full flex items-center justify-center text-green-600 z-10 shadow-sm">
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                                </div>
                                                            )}

                                                            <div>
                                                                <div className="flex justify-between items-start mb-6">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-ink/60">
                                                                            Fiche N°{post.acf?.lecon_comprendre || 'N/A'}
                                                                        </span>
                                                                    </div>
                                                                    <span className="inline-block px-2 py-0.5 border border-ink/20 text-[9px] font-mono uppercase tracking-widest text-ink/60">
                                                                        {cat ? cat.name : 'Concept'}
                                                                    </span>
                                                                </div>
                                                                <h3 className={`text-2xl md:text-3xl font-black uppercase leading-[0.9] mb-4 ${isCompleted ? 'text-ink/80' : 'text-ink'}`} dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                                                                <div className="font-serif text-ink/70 text-sm md:text-base leading-relaxed line-clamp-2" dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />
                                                            </div>

                                                            <div className="mt-8 flex items-center gap-3 text-xs font-mono font-bold uppercase tracking-widest text-lassez-red">
                                                                <span className={`w-6 h-[2px] transition-colors ${isCompleted ? 'bg-green-600' : 'bg-lassez-red'}`}></span>
                                                                <span className={isCompleted ? 'text-green-600' : 'text-lassez-red'}>{isCompleted ? 'Réviser' : 'Étudier'}</span>
                                                            </div>
                                                        </Link>
                                                    </div>

                                                    {/* Central Node Side (Desktop) */}
                                                    <div className="hidden md:flex flex-col items-center justify-center w-[10%] relative z-10">
                                                        <div className={`w-8 h-8 rounded-none border-4 bg-paper transition-colors ${isCompleted ? 'border-green-600 bg-green-100' : 'border-ink group-hover:bg-lassez-red'}`}></div>
                                                        <div className="absolute left-1/2 top-1/2 w-16 h-1 bg-ink -translate-y-1/2 origin-left" style={{ transform: `translate(${isEven ? '-100%' : '0%'}, -50%)` }}></div>
                                                    </div>

                                                    {/* Empty Space for alignment */}
                                                    <div className="hidden md:block w-[45%]"></div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <style>{`
                .outline-text { -webkit-text-stroke: 1px #1a1a1a; color: transparent; paint-order: stroke fill; }
                @media (min-width: 768px) { .outline-text { -webkit-text-stroke: 4px #1a1a1a; } }
            `}</style>
        </div>
    );
};

export default ComprendreClient;
