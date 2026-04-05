'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePosts } from '../hooks/usePosts';
import { useCategories } from '../hooks/useCategories';
import ArticleListItem from './ArticleListItem';
import { AlertTriangleIcon, SearchIcon, XIcon, LoaderIcon, ChevronLeftIcon } from './icons';

const PER_PAGE = 10;

const EnquetesClient: React.FC = () => {
    const { categories, isLoading: isCatsLoading } = useCategories();

    const mainCategory = categories.find(c => ['enquetes', 'enquete', 'dossiers'].includes(c.slug));
    const mainCategoryId = mainCategory ? mainCategory.id : null;

    const searchParams = useSearchParams();
    const secteurQuery = searchParams?.get('secteur');

    const [selectedSubCategoryIds, setSelectedSubCategoryIds] = useState<number[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        if (isCatsLoading) return;
        if (secteurQuery) {
            const cat = categories.find(c => c.slug === secteurQuery);
            if (cat) {
                setSelectedSubCategoryIds([cat.id]);
                setCurrentPage(1);
            }
        } else if (searchParams?.has('reset')) {
            setSelectedSubCategoryIds([]);
            setCurrentPage(1);
        }
    }, [secteurQuery, searchParams, categories, isCatsLoading]);

    const queryParams = useMemo(() => {
        if (isCatsLoading) return null;
        if (!mainCategoryId) return null;

        const params = [`page=${currentPage}`, `per_page=${PER_PAGE}`, '_embed'];
        params.push(`categories=${mainCategoryId}`);

        if (searchTerm.trim()) {
            params.push(`search=${encodeURIComponent(searchTerm.trim())}`);
        }
        return params.join('&');
    }, [mainCategoryId, selectedSubCategoryIds, searchTerm, currentPage, isCatsLoading]);

    const { data: posts = [], isLoading, error } = usePosts(queryParams || null);

    const availableFilters = useMemo(() => {
        if (!mainCategoryId || posts.length === 0) return [];
        const allIds = posts.flatMap(p => p.categories);
        const uniqueIds = Array.from(new Set(allIds));
        return uniqueIds
            .map(id => categories.find(c => c.id === id))
            .filter(c => c && c.id !== mainCategoryId && c.id !== 1)
            .sort((a, b) => a!.name.localeCompare(b!.name));
    }, [posts, categories, mainCategoryId]);

    const filteredPosts = useMemo(() => {
        if (selectedSubCategoryIds.length === 0) return posts;
        return posts.filter(post =>
            selectedSubCategoryIds.some(id => post.categories.includes(id))
        );
    }, [posts, selectedSubCategoryIds]);

    const toggleCategory = (id: number) => {
        setSelectedSubCategoryIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const clearFilters = () => {
        setSelectedSubCategoryIds([]);
        setSearchTerm('');
        setCurrentPage(1);
    };

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    const pageNumbers = useMemo(() => {
        const pages = [];
        const start = Math.max(1, currentPage - 2);
        const end = posts.length === PER_PAGE ? currentPage + 2 : currentPage;
        for (let i = start; i <= end; i++) pages.push(i);
        return pages;
    }, [currentPage, posts.length]);

    return (
        <div className="relative min-h-screen pb-12">
            <div className="fixed top-0 right-0 w-32 md:w-64 h-32 md:h-64 border-l-4 border-b-4 border-lassez-border -z-10 opacity-10 md:opacity-20 pointer-events-none"></div>

            <div className="mb-6 md:mb-12 border-b-4 border-lassez-border pb-4 md:pb-8 relative">
                <div className="hidden md:block absolute -top-6 left-0 bg-ink text-paper px-2 py-1 text-[10px] font-mono uppercase tracking-widest">
                    Zone Archives - Indexation Paginale
                </div>
                <h1 className="text-3xl md:text-7xl font-black uppercase tracking-tightest mb-4 leading-none text-ink">
                    Dossiers <br className="md:hidden" /><span className="text-lassez-red underline decoration-4 underline-offset-4">d'Enquête</span>
                </h1>
                <p className="text-base md:text-xl font-serif italic border-l-4 border-lassez-border pl-4 md:pl-6 py-2 max-w-3xl bg-paper-bright shadow-hard-sm text-ink">
                    "Nous assemblons les pièces du puzzle que les puissants tentent de disperser."
                </p>
            </div>

            <div className="flex flex-col gap-4 mb-8 md:mb-12 p-3 md:p-5 bg-paper-bright border-4 border-lassez-border shadow-hard sticky top-24 z-40">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex items-center justify-between font-mono font-bold text-[10px] md:text-xs uppercase md:border-r-2 md:border-lassez-border md:pr-4 text-ink">
                        <span className="flex items-center gap-2">
                            FILTRAGE_DYNAMIQUE {selectedSubCategoryIds.length > 0 && <span className="bg-lassez-red text-ink px-1 animate-pulse">{selectedSubCategoryIds.length}</span>}
                        </span>
                        {(selectedSubCategoryIds.length > 0 || searchTerm) && (
                            <button onClick={clearFilters} className="md:hidden text-lassez-red underline text-[9px]">Réinitialiser</button>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 flex-1">
                        {isCatsLoading ? (
                            <div className="flex items-center gap-2 text-ink/40 font-mono text-[10px]">
                                <LoaderIcon className="w-3 h-3 animate-spin" /> CHARGEMENT DES SECTEURS...
                            </div>
                        ) : availableFilters.length === 0 && posts.length > 0 ? (
                            <span className="text-xs text-gray-400 font-mono uppercase">Aucun sous-secteur détecté</span>
                        ) : (
                            availableFilters.map((cat) => {
                                if (!cat) return null;
                                const isSelected = selectedSubCategoryIds.includes(cat.id);
                                return (
                                    <button
                                        key={cat.id}
                                        onClick={() => toggleCategory(cat.id)}
                                        className={`px-2 md:px-3 py-1 border-2 border-lassez-border text-[9px] md:text-xs font-black uppercase transition-all shadow-hard-sm active:translate-y-[1px] active:shadow-none ${isSelected ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-ink hover:text-paper'}`}
                                    >
                                        {cat.name}
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="flex items-center border-b-2 border-lassez-border bg-paper px-2 group focus-within:border-lassez-red transition-colors">
                        <SearchIcon className="w-4 h-4 mr-2 text-ink/40 group-focus-within:text-ink" />
                        <input
                            type="text"
                            placeholder="RECHERCHER..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="bg-transparent outline-none font-mono text-[10px] md:text-sm uppercase w-full md:w-48 placeholder:text-ink/30 py-2 text-ink"
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')}><XIcon className="w-4 h-4 text-ink/40 hover:text-ink" /></button>
                        )}
                    </div>

                    {(selectedSubCategoryIds.length > 0 || searchTerm) && (
                        <button onClick={clearFilters} className="hidden md:flex items-center gap-1 bg-paper hover:bg-ink hover:text-paper border-2 border-lassez-border px-2 py-1 font-mono text-[9px] uppercase transition-colors text-ink">
                            <XIcon className="w-3 h-3" /> RESET
                        </button>
                    )}
                </div>
            </div>

            {isLoading && (
                <div className="flex justify-center py-16 border-y-4 border-dashed border-lassez-border bg-lassez-red/5">
                    <div className="text-sm md:text-xl font-black font-mono animate-pulse flex items-center uppercase tracking-tighter text-ink">
                        <span className="animate-spin mr-3">/</span> Accès aux dossiers chiffrés...
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-lassez-red/10 border-4 border-lassez-red text-ink p-4 md:p-6 shadow-hard" role="alert">
                    <h3 className="font-black text-lg md:text-xl uppercase flex items-center mb-2"><AlertTriangleIcon className="mr-3 w-5 h-5 md:w-6 md:h-6 text-lassez-red" /> Echec Protocole</h3>
                    <p className="font-mono text-[10px] md:text-sm">Impossible d'accéder aux archives centrales. Vérifiez votre connexion au réseau.</p>
                </div>
            )}

            <div className="space-y-6 md:space-y-8">
                {filteredPosts.map((post, index) => (
                    <div key={post.id} className="relative pl-8 md:pl-20">
                        <div className="absolute left-[15px] md:left-[39px] top-0 bottom-0 w-[1px] md:w-[2px] bg-lassez-border/10 border-l border-dashed border-lassez-border/30"></div>
                        <div className="absolute left-1 md:left-6 top-8 w-5 h-5 md:w-6 md:h-6 bg-ink text-paper rounded-full flex items-center justify-center text-[9px] md:text-[10px] font-mono font-bold z-10 ring-2 md:ring-4 ring-paper shadow-hard-sm">
                            {(currentPage - 1) * PER_PAGE + index + 1}
                        </div>
                        <div className="hidden lg:block absolute left-0 top-20 -rotate-90 origin-center w-20 text-center">
                            <span className="text-[10px] font-mono font-bold text-ink/30 tracking-widest">REF-{3902 + (currentPage * index)}</span>
                        </div>
                        <ArticleListItem post={post} />
                    </div>
                ))}
            </div>

            {!isLoading && filteredPosts.length > 0 && (
                <nav className="mt-16 flex flex-col items-center gap-6 border-t-4 border-lassez-border pt-12">
                    <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-ink/40 mb-2">
                        Indexation des pages : Section {currentPage}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className={`flex items-center gap-2 px-4 py-3 border-2 border-lassez-border font-black uppercase text-xs transition-all shadow-hard-sm ${currentPage === 1 ? 'opacity-20 cursor-not-allowed' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper active:translate-y-1 active:shadow-none'}`}
                        >
                            <ChevronLeftIcon className="w-4 h-4" /> Précédent
                        </button>

                        <div className="flex items-center gap-1 mx-4">
                            {pageNumbers.map(n => (
                                <button
                                    key={n}
                                    onClick={() => handlePageChange(n)}
                                    className={`w-10 h-10 flex items-center justify-center border-2 border-lassez-border font-mono font-black text-sm transition-all ${currentPage === n ? 'bg-lassez-red text-ink shadow-hard-sm -translate-y-1' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper shadow-none'}`}
                                >
                                    {n < 10 ? `0${n}` : n}
                                </button>
                            ))}
                            {posts.length === PER_PAGE && !pageNumbers.includes(currentPage + 1) && (
                                <span className="text-ink font-mono px-2">...</span>
                            )}
                        </div>

                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={posts.length < PER_PAGE}
                            className={`flex items-center gap-2 px-4 py-3 border-2 border-lassez-border font-black uppercase text-xs transition-all shadow-hard-sm ${posts.length < PER_PAGE ? 'opacity-20 cursor-not-allowed' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper active:translate-y-1 active:shadow-none'}`}
                        >
                            Suivant <span className="rotate-180"><ChevronLeftIcon className="w-4 h-4" /></span>
                        </button>
                    </div>
                </nav>
            )}

            {!isLoading && !isCatsLoading && !mainCategoryId && (
                <div className="text-center font-mono mt-8 border-4 border-lassez-red bg-lassez-red/10 p-8 md:p-12 text-ink">
                    <h3 className="font-black text-xl uppercase mb-2">Configuration Requise</h3>
                    <p className="font-bold text-xs md:text-sm uppercase mb-4">La catégorie "Enquêtes" (slug: enquetes) est introuvable.</p>
                </div>
            )}

            {!isLoading && filteredPosts.length === 0 && mainCategoryId && (
                <div className="text-center font-mono mt-8 border-2 border-lassez-border border-dashed p-8 md:p-12 bg-lassez-red/5 text-ink">
                    <p className="font-bold text-xs md:text-sm uppercase">AUCUN DOSSIER TROUVÉ.</p>
                </div>
            )}
        </div>
    );
};

export default EnquetesClient;
