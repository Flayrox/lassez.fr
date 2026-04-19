'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ArticleCard from './ArticleCard';
import { usePosts } from '../hooks/usePosts';
import { LoaderIcon, SearchIcon, XIcon, AlertTriangleIcon } from './icons';
import { useCategories } from '../hooks/useCategories';

const SearchClientInner: React.FC = () => {
    const searchParams = useSearchParams();
    const router = useRouter();
    const queryFromUrl = searchParams.get('q') || '';

    const [localQuery, setLocalQuery] = useState(queryFromUrl);
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    const { categories } = useCategories();

    const { posts: results, isLoading, error } = usePosts(
        queryFromUrl
            ? {
                  search: queryFromUrl,
                  perPage: 20,
                  category: activeFilter ?? undefined,
                  depth: 1,
              }
            : null
    );

    useEffect(() => {
        setLocalQuery(queryFromUrl);
    }, [queryFromUrl]);

    useEffect(() => {
        setActiveFilter(null);
    }, [queryFromUrl]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (localQuery.trim()) {
            router.push(`/search?q=${encodeURIComponent(localQuery.trim())}`);
        }
    };

    const handleClear = () => {
        setLocalQuery('');
        router.push('/search');
        setActiveFilter(null);
    };

    const getCatId = (slug: string) => categories?.find(c => c.slug === slug)?.id.toString();

    const filters = [
        { label: 'Tout', id: null },
        { label: 'Enquêtes', id: getCatId('enquetes') },
        { label: 'Révélations', id: getCatId('revelations') },
        { label: 'Antenne (Audio)', id: getCatId('podcasts') || getCatId('antenne') },
        { label: 'Comprendre', id: getCatId('comprendre') },
    ];

    return (
        <div className="max-w-5xl mx-auto pb-20">
            <header className="mb-8 border-b-4 border-black pb-8">
                <div className="inline-block bg-black text-white px-2 py-1 mb-4 font-mono text-[10px] uppercase tracking-widest">
                    Module_Recherche_v2.4
                </div>
                <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter leading-none mb-8">
                    Index des <span className="text-lassez-red">Dossiers</span>
                </h1>

                <form onSubmit={handleSubmit} className="relative group mb-8">
                    <div className="absolute -top-3 left-6 bg-white border-2 border-black px-2 py-0.5 text-[9px] font-mono font-bold uppercase z-10 transition-colors group-focus-within:text-lassez-red group-focus-within:border-lassez-red">
                        Paramètre de scan
                    </div>
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <input
                                type="text"
                                value={localQuery}
                                onChange={(e) => setLocalQuery(e.target.value)}
                                placeholder="NOM, LIEU, ENTREPRISE, MOT-CLÉ..."
                                className="w-full bg-white border-4 border-black p-5 md:p-6 text-lg md:text-2xl font-mono uppercase focus:outline-none focus:ring-0 focus:bg-yellow-50 shadow-hard group-hover:shadow-hard-xl transition-all placeholder:text-gray-200"
                            />
                            {localQuery && (
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:text-lassez-red transition-colors"
                                >
                                    <XIcon className="w-8 h-8" />
                                </button>
                            )}
                        </div>
                        <button
                            type="submit"
                            className="bg-lassez-red text-white border-4 border-black px-8 py-4 md:py-0 font-black text-xl uppercase tracking-widest hover:bg-black transition-colors shadow-hard active:translate-x-1 active:translate-y-1 active:shadow-none flex items-center justify-center gap-3"
                        >
                            <SearchIcon className="w-6 h-6" />
                            <span>Scanner</span>
                        </button>
                    </div>
                </form>

                {queryFromUrl && (
                    <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
                        {filters.map(filter => (
                            filter.id !== undefined && (
                                <button
                                    key={filter.label}
                                    onClick={() => setActiveFilter(filter.id || null)}
                                    className={`px-4 py-2 text-xs font-black uppercase tracking-widest border-2 transition-all ${activeFilter === filter.id ? 'bg-black text-white border-black' : 'bg-white text-gray-500 border-gray-200 hover:border-black hover:text-black'}`}
                                >
                                    {filter.label}
                                </button>
                            )
                        ))}
                    </div>
                )}
            </header>

            <div className="px-4 md:px-0">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-gray-50 border-4 border-dashed border-gray-200">
                        <LoaderIcon className="w-12 h-12 animate-spin text-lassez-red" />
                        <p className="font-mono text-sm font-bold uppercase animate-pulse">Interrogation des archives centrales...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border-4 border-red-600 p-6 text-red-900 shadow-hard">
                        <h3 className="font-black text-xl uppercase flex items-center gap-3 mb-2">
                            <AlertTriangleIcon className="w-6 h-6" /> Erreur de protocole
                        </h3>
                        <p className="font-mono text-sm">Le serveur de recherche ne répond pas. Code erreur: DB_REF_FAIL_{Math.floor(Math.random() * 999)}</p>
                    </div>
                ) : queryFromUrl && results && results.length > 0 ? (
                    <>
                        <div className="mb-8 flex items-center gap-4">
                            <span className="h-[2px] flex-1 bg-gray-200"></span>
                            <h2 className="font-mono text-xs font-bold uppercase text-gray-400">
                                {results.length} RÉVÉLATION(S) TROUVÉE(S)
                            </h2>
                            <span className="h-[2px] flex-1 bg-gray-200"></span>
                        </div>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {results.map(post => (
                                <ArticleCard key={post.id} post={post} />
                            ))}
                        </div>
                    </>
                ) : queryFromUrl ? (
                    <div className="text-center py-24 bg-gray-100 border-4 border-dashed border-black relative overflow-hidden group">
                        <div className="absolute inset-0 opacity-5 pointer-events-none font-mono text-[80px] font-black break-all select-none">
                            VOID NULL EMPTY VOID NULL EMPTY VOID NULL EMPTY
                        </div>
                        <p className="font-mono font-bold uppercase text-lg relative z-10">
                            Aucune trace trouvée pour <span className="text-lassez-red">"{queryFromUrl}"</span>.
                        </p>
                        <p className="text-sm text-gray-500 mt-2 relative z-10">
                            {activeFilter ? "Essayez de désactiver les filtres." : "Vérifiez l'orthographe ou essayez un terme moins spécifique."}
                        </p>
                        <button onClick={handleClear} className="mt-6 relative z-10 underline font-black uppercase text-xs hover:text-lassez-red">
                            Réinitialiser la recherche
                        </button>
                    </div>
                ) : (
                    <div className="py-20 text-center border-4 border-black bg-white shadow-hard-sm">
                        <div className="max-w-md mx-auto">
                            <div className="w-16 h-16 border-4 border-black flex items-center justify-center mx-auto mb-6 transform rotate-12">
                                <SearchIcon className="w-8 h-8" />
                            </div>
                            <p className="font-serif italic text-xl mb-4">"L'ombre ne craint que la lumière de la vérité."</p>
                            <p className="font-mono text-[10px] uppercase text-gray-400 tracking-widest">Entrez une requête ci-dessus pour fouiller dans nos dossiers confidentiels.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const SearchClient: React.FC = () => {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-20 gap-4 bg-gray-50 border-4 border-dashed border-gray-200">
                <LoaderIcon className="w-12 h-12 animate-spin text-lassez-red" />
                <p className="font-mono text-sm font-bold uppercase animate-pulse">Chargement de la base de données...</p>
            </div>
        }>
            <SearchClientInner />
        </Suspense>
    );
};

export default SearchClient;
