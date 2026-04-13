'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePosts } from '../hooks/usePosts';
import { useCategories } from '../hooks/useCategories';
import { AlertTriangleIcon, LoaderIcon, ChevronUpIcon } from './icons';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface WPTag {
    id: number;
    name: string;
    slug: string;
    count: number;
}

const RevelationsClient: React.FC = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { categories, isLoading: isCatsLoading } = useCategories();
    const mainCategory = categories.find(c => ['revelations', 'revelation', 'fuites'].includes(c.slug));
    const mainCategoryId = mainCategory ? mainCategory.id : null;

    const [perPage, setPerPage] = useState(12);
    const [expandedParams, setExpandedParams] = useState<number[]>([]);
    const [wpTags, setWpTags] = useState<WPTag[]>([]);

    const geoFilter = (searchParams?.get('geo') as 'all' | 'france' | 'international') || 'all';
    const activeTagSlug = searchParams?.get('tag');

    // Charger les tags WordPress qui ont des articles
    useEffect(() => {
        async function fetchTags() {
            try {
                const res = await fetch('/api/wp/tags?per_page=30&orderby=count&order=desc');
                if (res.ok) {
                    const tags = await res.json();
                    setWpTags(tags.filter((t: WPTag) => t.count > 0));
                }
            } catch (_) { }
        }
        fetchTags();
    }, []);

    const activeTagId = useMemo(() => {
        if (!activeTagSlug || wpTags.length === 0) return null;
        const tag = wpTags.find(t => t.slug === activeTagSlug);
        return tag ? tag.id : null;
    }, [activeTagSlug, wpTags]);

    const queryParams = useMemo(() => {
        if (isCatsLoading) return null;
        if (!mainCategoryId) return null;
        let params = `per_page=${perPage}&_embed&categories=${mainCategoryId}`;
        if (activeTagId) params += `&tags=${activeTagId}`;
        return params;
    }, [perPage, mainCategoryId, isCatsLoading, activeTagId]);

    const { data: posts = [], isLoading, error } = usePosts(queryParams || null);

    // Filtrage geo côté client (basé sur les tags)
    const filteredPosts = useMemo(() => {
        if (geoFilter === 'all') return posts;
        return posts.filter(post => {
            const postTags = (post as any)._embedded?.['wp:term']?.[1] || [];
            const tagNames = postTags.map((t: any) => t.name?.toLowerCase());
            if (geoFilter === 'france') {
                return tagNames.some((t: string) =>
                    ['france', 'politique', 'macron', 'mélenchon', 'lfi', 'rn', 'police', 'grève'].includes(t)
                ) || !tagNames.some((t: string) =>
                    ['usa', 'international', 'palestine', 'israël', 'ukraine', 'russie', 'chine'].includes(t)
                );
            } else {
                return tagNames.some((t: string) =>
                    ['usa', 'international', 'palestine', 'israël', 'ukraine', 'russie', 'chine', 'guerre'].includes(t)
                );
            }
        });
    }, [posts, geoFilter]);

    const toggleExpand = (id: number) => {
        setExpandedParams(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);
    };

    const loadMore = () => {
        setPerPage(prev => prev + 12);
    };

    const handleTagClick = (tagSlug: string) => {
        const params = new URLSearchParams(searchParams?.toString());
        if (activeTagSlug === tagSlug) {
            params.delete('tag');
        } else {
            params.set('tag', tagSlug);
        }
        router.push(`/revelations?${params.toString()}`);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-black text-white py-8 sticky top-0 z-30 shadow-hard border-b-4 border-lassez-red">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="w-3 h-3 bg-lassez-red rounded-full animate-ping absolute top-0 left-0"></div>
                            <div className="w-3 h-3 bg-lassez-red rounded-full relative z-10"></div>
                        </div>
                        <h1 className="font-black text-2xl md:text-3xl uppercase tracking-tighter leading-none">
                            Flux <span className="text-lassez-red">Révélations</span>
                        </h1>
                    </div>
                    <div className="text-[10px] font-mono opacity-50 hidden md:block">
                        CANAL_SÉCURISÉ_V3.8 // {(new Date()).toLocaleTimeString()}
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-3xl">
                {!isLoading && !isCatsLoading && !mainCategoryId && (
                    <div className="border-4 border-black bg-yellow-400 p-8 text-center text-black mb-8 shadow-hard">
                        <h3 className="font-black text-xl uppercase mb-2">Canal Introuvable</h3>
                        <p className="font-bold text-sm uppercase">La catégorie "Révélations" n'existe pas.</p>
                    </div>
                )}

                {isLoading && posts.length === 0 ? (
                    <div className="flex justify-center py-20">
                        <div className="flex items-center gap-4 text-black/50 font-mono font-bold text-xl uppercase animate-pulse">
                            <LoaderIcon className="w-8 h-8 animate-spin" />
                            Connexion au flux...
                        </div>
                    </div>
                ) : error ? (
                    <div className="bg-lassez-red/10 border-4 border-lassez-red text-ink p-8 text-center" role="alert">
                        <h3 className="font-black text-xl uppercase mb-2 flex items-center justify-center gap-3">
                            <AlertTriangleIcon className="w-6 h-6 text-lassez-red" />
                            Signal Perdu
                        </h3>
                    </div>
                ) : (
                    <div className="relative border-l-2 border-black/10 ml-4 md:ml-0 space-y-8 md:space-y-0">
                        {filteredPosts.map((post, index) => {
                            const isExpanded = expandedParams.includes(post.id);
                            const securityLevel = post.acf?.security_level || 'PUBLIC';
                            const date = new Date(post.date);
                            const postTags = (post as any)._embedded?.['wp:term']?.[1] || [];

                            return (
                                <div key={post.id} id={post.slug} className="relative md:pl-8 pb-12 group scroll-mt-32">
                                    <div className={`absolute -left-[5px] md:-left-[5px] top-0 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-colors duration-300 z-10 ${index === 0 ? 'bg-lassez-red animate-pulse' : 'bg-black group-hover:bg-lassez-red'}`}></div>
                                    <div className="md:absolute md:-left-32 md:top-0 md:text-right w-24 mb-2 md:mb-0">
                                        <div className="font-mono text-xs font-bold text-lassez-red">{format(date, 'HH:mm')}</div>
                                        <div className="text-[10px] uppercase font-bold text-gray-400">{format(date, 'dd MMM', { locale: fr })}</div>
                                    </div>
                                    <div className={`bg-white border-2 border-black shadow-hard transition-all duration-300 ${isExpanded ? 'shadow-hard-xl -translate-y-1' : 'hover:shadow-hard-md hover:-translate-y-0.5 cursor-pointer'}`} onClick={() => !isExpanded && toggleExpand(post.id)}>
                                        <div className="p-4 md:p-6 bg-paper-bright relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-2">
                                                <span className={`inline-block px-2 py-0.5 text-[9px] font-black uppercase border border-black/20 ${securityLevel === 'CONFIDENTIEL' ? 'bg-lassez-red text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                    {securityLevel}
                                                </span>
                                            </div>
                                            <h3 className="font-black text-lg md:text-2xl uppercase leading-tight pr-12 mb-2">
                                                <span dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                                            </h3>
                                            {post.content.rendered.length < 300 ? (
                                                <div className="font-serif text-sm md:text-base text-gray-800 leading-relaxed prose prose-sm max-w-none mb-4" dangerouslySetInnerHTML={{ __html: post.content.rendered }} />
                                            ) : (
                                                <div className="font-serif text-sm md:text-base text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: post.excerpt.rendered }} />
                                            )}

                                            {/* Tags sous l'article */}
                                            {postTags.length > 0 && (
                                                <div className="mt-5 pt-4 border-t-2 border-black/5 flex flex-wrap gap-2">
                                                    {postTags.map((tag: any) => (
                                                        <button
                                                            key={tag.id}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleTagClick(tag.slug);
                                                            }}
                                                            className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-widest border-2 transition-all ${activeTagSlug === tag.slug
                                                                ? 'bg-black text-white border-black shadow-[2px_2px_0px_#FF0000]'
                                                                : 'bg-white text-gray-500 border-black/10 hover:border-lassez-red hover:text-lassez-red'
                                                                }`}
                                                        >
                                                            {tag.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {post.content.rendered.length >= 300 ? (
                                                <div className="mt-4 flex items-center justify-between">
                                                    <button onClick={(e) => { e.stopPropagation(); toggleExpand(post.id); }} className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-black hover:text-lassez-red transition-colors">
                                                        {isExpanded ? 'Réduire' : 'Déplier le message'}
                                                        <ChevronUpIcon className={`w-3 h-3 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
                                                    </button>
                                                    {post.acf?.source_pdf_url && (
                                                        <a href={post.acf.source_pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase text-lassez-red underline decoration-2 underline-offset-2 hover:bg-lassez-red hover:text-white transition-colors px-1" onClick={(e) => e.stopPropagation()}>
                                                            Source Vérifiée
                                                        </a>
                                                    )}
                                                </div>
                                            ) : (
                                                post.acf?.source_pdf_url && (
                                                    <div className="mt-4 flex justify-end">
                                                        <a href={post.acf.source_pdf_url} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold uppercase text-lassez-red underline decoration-2 underline-offset-2 hover:bg-lassez-red hover:text-white transition-colors px-1" onClick={(e) => e.stopPropagation()}>
                                                            Source Vérifiée
                                                        </a>
                                                    </div>
                                                )
                                            )}
                                        </div>
                                        {post.content.rendered.length >= 300 && (
                                            <div className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${isExpanded ? 'max-h-[1000px] border-t-2 border-black/10' : 'max-h-0'}`}>
                                                <div className="p-4 md:p-6 bg-gray-50 font-serif text-sm md:text-base text-gray-800 leading-relaxed prose prose-sm max-w-none">
                                                    <div dangerouslySetInnerHTML={{ __html: post.content.rendered }} />
                                                    <div className="mt-6 pt-4 border-t border-black/10 flex items-center gap-2 text-[9px] font-mono text-gray-400 uppercase">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                        Authenticité confirmée par la rédaction.
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {filteredPosts.length >= perPage && (
                    <button onClick={loadMore} className="mx-auto block mt-12 px-6 py-3 border-2 border-black font-black uppercase text-xs hover:bg-black hover:text-white transition-all">
                        Charger l'historique
                    </button>
                )}
            </div>
        </div>
    );
};

export default RevelationsClient;
