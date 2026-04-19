'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import useSWR from 'swr';
import { useSearchParams } from 'next/navigation';
import { usePosts } from '../hooks/usePosts';
import { useCategories } from '../hooks/useCategories';
import { AlertTriangleIcon, SearchIcon, XIcon, LoaderIcon, ChevronLeftIcon } from './icons';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import GlitchImage from './GlitchImage';
import type { Post, Category } from '../payload-types';

const PER_PAGE = 10;

function safeDate(raw: string | null | undefined): Date | null {
    if (!raw) return null;
    try {
        const d = parseISO(raw);
        return isValid(d) ? d : null;
    } catch {
        return null;
    }
}

function getArticleUrl(post: Post): string {
    const cats = post.categories as Category[] | null;
    const primarySlug = Array.isArray(cats) && cats.length > 0 && typeof cats[0] === 'object'
        ? cats[0].slug
        : null;
    if (!primarySlug || primarySlug === 'revelations') return `/revelations/${post.slug}`;
    return `/${primarySlug}/${post.slug}`;
}

// ─── Carte Article ─────────────────────────────────────────────────────────────────
function PostCard({ post, index, page }: { post: Post; index: number; page: number }) {
    const cats = (post.categories as Category[] | null) ?? [];
    const typedCats = cats.filter((c): c is Category => typeof c === 'object');
    const cover  = typeof post.featuredImage === 'object' && post.featuredImage?.url
        ? post.featuredImage.url
        : `https://picsum.photos/seed/${post.id}/400/300`;
    const author = typeof post.author === 'object' && post.author?.name
        ? post.author.name
        : 'Rédaction';
    const date   = safeDate(post.publishedAt) ?? safeDate(post.createdAt);

    return (
        <Link href={getArticleUrl(post)} className="block">
            <article className="group relative flex flex-col md:flex-row bg-white border-2 border-black shadow-hard hover:shadow-hard-xl hover:-translate-y-1 hover:-translate-x-1 transition-all duration-200 cursor-pointer min-h-[200px]">
                {/* Image */}
                <div className="md:w-64 h-48 md:h-auto flex-shrink-0 border-b-2 md:border-b-0 md:border-r-2 border-black relative bg-gray-100 overflow-hidden">
                    <div className="absolute top-0 left-0 flex flex-wrap gap-1 z-20">
                        {typedCats.slice(0, 2).map(cat => (
                            <div key={cat.id} className="bg-black text-white text-[8px] font-black uppercase px-2 py-0.5">
                                {cat.name}
                            </div>
                        ))}
                    </div>
                    <div className="absolute inset-0 bg-lassez-red mix-blend-multiply opacity-0 group-hover:opacity-20 transition-opacity z-10 pointer-events-none" />
                    <GlitchImage src={cover} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>

                {/* Content */}
                <div className="flex flex-col p-4 md:p-6 flex-grow justify-between relative">
                    <div>
                        <div className="flex items-center text-[10px] font-mono font-bold text-gray-500 mb-3 border-b-2 border-gray-100 pb-2 uppercase tracking-widest">
                            <span>{date ? format(date, 'dd.MM.yy', { locale: fr }) : '—'}</span>
                            <span className="mx-2 text-lassez-red">///</span>
                            <span>Ag. {author.split(' ')[0]}</span>
                        </div>

                        <h3
                            className="text-lg md:text-2xl font-serif font-black text-ink leading-tight mb-3 group-hover:text-lassez-red transition-colors uppercase"
                            dangerouslySetInnerHTML={{ __html: post.title }}
                        />
                        <div
                            className="text-gray-600 font-sans text-sm leading-relaxed line-clamp-3"
                            dangerouslySetInnerHTML={{ __html: post.excerpt ?? '' }}
                        />
                    </div>

                    <div className="flex items-center justify-end pt-4 mt-2">
                        <span className="text-[10px] font-mono font-bold uppercase bg-white border-2 border-black px-3 py-1 group-hover:bg-black group-hover:text-white transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-none group-hover:translate-x-[2px] group-hover:translate-y-[2px]">
                            Ouvrir le dossier
                        </span>
                    </div>
                </div>
            </article>
        </Link>
    );
}

// ─── Page principale Enquêtes ────────────────────────────────────────────────────
const EnquetesClient: React.FC = () => {
    const searchParams = useSearchParams();
    const { categories } = useCategories();

    // Secteur depuis l'URL (?secteur=slug), résolu en ID Payload
    const secteurSlug = searchParams?.get('secteur') ?? null;
    const selectedCategoryIdFromUrl = useMemo(() => {
        if (!secteurSlug || categories.length === 0) return null;
        const found = categories.find((c: any) => c.slug === secteurSlug);
        return found ? String(found.id) : null;
    }, [secteurSlug, categories]);

    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

    useEffect(() => {
        setSelectedCategoryId(selectedCategoryIdFromUrl);
        setCurrentPage(1);
    }, [selectedCategoryIdFromUrl]);

    const [searchTerm, setSearchTerm]   = useState('');
    const [currentPage, setCurrentPage] = useState(1);

    const { posts, total, totalPages, isLoading, error } = usePosts({
        page: currentPage,
        perPage: PER_PAGE,
        search: searchTerm.trim() || undefined,
        category: selectedCategoryId ?? undefined,
        depth: 1,
    });

    // Catégories qui ont au moins un article publié.
    // On charge un max de 200 articles (depth:0 = IDs seules) pour extraire les cat IDs actifs.
    const { data: allPostsData } = useSWR<{ docs: { categories: (Category | string | number)[] }[] }>(
        '/api/posts?per_page=200&depth=1',
        (url: string) => fetch(url).then(r => r.json()),
        { revalidateOnFocus: false, dedupingInterval: 120_000 }
    );

    const activeCategoryIds = useMemo(() => {
        if (!allPostsData?.docs) return null; // null = pas encore chargé, on n'a rien à filtrer
        const ids = new Set<string>();
        for (const p of allPostsData.docs) {
            const cats = Array.isArray(p.categories) ? p.categories : [];
            for (const c of cats) {
                if (typeof c === 'object' && c !== null) ids.add(String((c as Category).id));
                else if (typeof c === 'string') ids.add(c);
            }
        }
        return ids;
    }, [allPostsData]);

    const availableCategories = useMemo(() => {
        const filtered = categories.filter(c => c.slug !== 'revelations' && (c as any).enabled !== false);
        // Si les données ne sont pas encore chargées, on montre tout (évite le flash)
        if (activeCategoryIds === null) return filtered;
        // Sinon, seulement les catégories qui ont au moins un article
        return filtered.filter(c => activeCategoryIds.has(String(c.id)));
    }, [categories, activeCategoryIds]);

    const handleCatToggle = useCallback((id: string) => {
        setSelectedCategoryId(prev => prev === id ? null : id);
        setCurrentPage(1);
    }, []);

    const clearFilters = () => {
        setSelectedCategoryId(null);
        setSearchTerm('');
        setCurrentPage(1);
    };

    const handlePage = (p: number) => {
        setCurrentPage(p);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="relative min-h-screen pb-12">
            {/* Header */}
            <div className="mb-6 md:mb-12 border-b-4 border-lassez-border pb-4 md:pb-8 relative">
                <h1 className="text-3xl md:text-7xl font-black uppercase tracking-tighter mb-4 leading-none text-ink">
                    Dossiers <br className="md:hidden" /><span className="text-lassez-red underline decoration-4 underline-offset-4">d'Enquête</span>
                </h1>
                <p className="text-base md:text-xl font-serif italic border-l-4 border-lassez-border pl-4 md:pl-6 py-2 max-w-3xl bg-paper-bright shadow-hard-sm text-ink">
                    &laquo;&nbsp;Nous assemblons les pièces du puzzle que les puissants tentent de disperser.&nbsp;&raquo;
                </p>
            </div>

            {/* Filtres */}
            <div className="flex flex-col gap-4 mb-8 p-4 bg-paper-bright border-4 border-lassez-border shadow-hard sticky top-24 z-40">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <span className="font-mono font-bold text-[10px] uppercase text-ink">
                        SECTEUR
                        {selectedCategoryId && (
                            <span className="ml-2 bg-lassez-red text-ink px-1 animate-pulse">1</span>
                        )}
                    </span>

                    <div className="flex flex-wrap gap-2 flex-1">
                        {availableCategories.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => handleCatToggle(String(cat.id))}
                                className={`px-3 py-1 border-2 border-lassez-border text-[10px] font-black uppercase transition-all shadow-hard-sm ${selectedCategoryId === String(cat.id) ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-ink hover:text-paper'}`}
                            >
                                {cat.name}
                            </button>
                        ))}
                    </div>

                    {/* Recherche */}
                    <div className="flex items-center border-b-2 border-lassez-border bg-paper px-2 group focus-within:border-lassez-red transition-colors">
                        <SearchIcon className="w-4 h-4 mr-2 text-ink/40 group-focus-within:text-ink" />
                        <input
                            type="text"
                            placeholder="RECHERCHER..."
                            value={searchTerm}
                            onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            className="bg-transparent outline-none font-mono text-[10px] uppercase w-full md:w-48 placeholder:text-ink/30 py-2 text-ink"
                        />
                        {searchTerm && <button onClick={() => setSearchTerm('')}><XIcon className="w-4 h-4 text-ink/40 hover:text-ink" /></button>}
                    </div>

                    {(selectedCategoryId || searchTerm) && (
                        <button onClick={clearFilters} className="flex items-center gap-1 bg-paper hover:bg-ink hover:text-paper border-2 border-lassez-border px-2 py-1 font-mono text-[9px] uppercase transition-colors text-ink">
                            <XIcon className="w-3 h-3" /> RESET
                        </button>
                    )}
                </div>
            </div>

            {/* État */}
            {isLoading && (
                <div className="flex justify-center py-16 border-y-4 border-dashed border-lassez-border bg-lassez-red/5">
                    <div className="text-xl font-black font-mono animate-pulse flex items-center uppercase tracking-tighter text-ink">
                        <span className="animate-spin mr-3">/</span> Accès aux dossiers chiffrés...
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-lassez-red/10 border-4 border-lassez-red text-ink p-6 shadow-hard" role="alert">
                    <h3 className="font-black text-xl uppercase flex items-center mb-2"><AlertTriangleIcon className="mr-3 w-6 h-6 text-lassez-red" /> Echec Protocole</h3>
                    <p className="font-mono text-sm">Impossible d'accéder aux archives centrales.</p>
                </div>
            )}

            {/* Liste */}
            <div className="space-y-6 md:space-y-8">
                {posts.map((post, i) => (
                    <div key={post.id} className="relative pl-8 md:pl-20">
                        <div className="absolute left-1 md:left-6 top-8 w-5 h-5 md:w-6 md:h-6 bg-ink text-paper rounded-full flex items-center justify-center text-[10px] font-mono font-bold z-10 ring-2 ring-paper shadow-hard-sm">
                            {(currentPage - 1) * PER_PAGE + i + 1}
                        </div>
                        <PostCard post={post} index={i} page={currentPage} />
                    </div>
                ))}
            </div>

            {!isLoading && posts.length === 0 && (
                <div className="text-center font-mono mt-8 border-2 border-lassez-border border-dashed p-12 bg-lassez-red/5 text-ink">
                    <p className="font-bold text-sm uppercase">AUCUN DOSSIER TROUVÉ.</p>
                </div>
            )}

            {/* Pagination */}
            {!isLoading && totalPages > 1 && (
                <nav className="mt-16 flex flex-col items-center gap-6 border-t-4 border-lassez-border pt-12">
                    <div className="font-mono text-[10px] uppercase font-bold tracking-widest text-ink/40">
                        Page {currentPage} / {totalPages} — {total} dossiers
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePage(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className={`flex items-center gap-2 px-4 py-3 border-2 border-lassez-border font-black uppercase text-xs transition-all shadow-hard-sm ${currentPage <= 1 ? 'opacity-20 cursor-not-allowed' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper'}`}
                        >
                            <ChevronLeftIcon className="w-4 h-4" /> Précédent
                        </button>

                        {Array.from({ length: Math.min(5, totalPages) }, (_, k) => {
                            const n = Math.max(1, currentPage - 2) + k;
                            if (n > totalPages) return null;
                            return (
                                <button
                                    key={n}
                                    onClick={() => handlePage(n)}
                                    className={`w-10 h-10 flex items-center justify-center border-2 border-lassez-border font-mono font-black text-sm transition-all ${currentPage === n ? 'bg-lassez-red text-ink shadow-hard-sm -translate-y-1' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper'}`}
                                >
                                    {n < 10 ? `0${n}` : n}
                                </button>
                            );
                        })}

                        <button
                            onClick={() => handlePage(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className={`flex items-center gap-2 px-4 py-3 border-2 border-lassez-border font-black uppercase text-xs transition-all shadow-hard-sm ${currentPage >= totalPages ? 'opacity-20 cursor-not-allowed' : 'bg-paper-bright text-ink hover:bg-ink hover:text-paper'}`}
                        >
                            Suivant <span className="rotate-180"><ChevronLeftIcon className="w-4 h-4" /></span>
                        </button>
                    </div>
                </nav>
            )}
        </div>
    );
};

export default EnquetesClient;
