'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LoaderIcon } from '../icons';
import useSWR from 'swr';
import type { Category } from '../../payload-types';

interface EnqueteSidebarProps {
    onClose: () => void;
}

// Slugs exclus de la sidebar (silos séparés ou meta-catégories non éditoriales)
const EXCLUDED_SLUGS = new Set(['revelations', 'enquetes']);

const fetcher = (url: string) => fetch(url).then(r => r.json());

const EnqueteSidebar: React.FC<EnqueteSidebarProps> = ({ onClose }) => {
    const pathname     = usePathname();
    const searchParams = useSearchParams();

    // Catégories depuis Payload
    const { data: catsData, isLoading: isCatsLoading } = useSWR<any>(
        '/api/categories?per_page=100',
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 300_000 }
    );

    // Tous les articles (léger, depth:0) pour savoir quelles catégories ont des articles
    const { data: postsData } = useSWR<{ docs: any[] }>(
        '/api/posts?per_page=200&depth=1',
        fetcher,
        { revalidateOnFocus: false, dedupingInterval: 120_000 }
    );

    // Calcul du count par catégorie à partir des articles
    const countByCatId = useMemo(() => {
        const counts = new Map<string, number>();
        if (!postsData?.docs) return counts;
        for (const p of postsData.docs) {
            const cats = Array.isArray(p.categories) ? p.categories : [];
            for (const c of cats) {
                const id = typeof c === 'object' && c !== null ? c.id : c;
                if (id) counts.set(String(id), (counts.get(String(id)) ?? 0) + 1);
            }
        }
        return counts;
    }, [postsData]);

    const { activeCategories, closedCategories } = useMemo(() => {
        const raw = Array.isArray(catsData) ? catsData : (catsData?.docs ?? []);
        const filtered = (raw as any[]).filter((cat: any) => !EXCLUDED_SLUGS.has(cat.slug));
        const sorted   = [...filtered].sort((a: any, b: any) => a.name.localeCompare(b.name));

        return {
            activeCategories: sorted.filter((cat: any) => (countByCatId.get(String(cat.id)) ?? 0) > 0),
            closedCategories: sorted.filter((cat: any) => (countByCatId.get(String(cat.id)) ?? 0) === 0),
        };
    }, [catsData, countByCatId]);

    const isLoading = isCatsLoading || !postsData;

    return (
        <>
            {/* Desktop Title */}
            <div className="hidden lg:flex p-6 border-b-4 border-ink bg-ink/5 items-center justify-between">
                <h2 className="font-black uppercase text-xl tracking-tighter text-ink">Enquêtes</h2>
                <div className="w-3 h-3 bg-lassez-red rounded-full animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="mb-10 lg:mb-8">
                    <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60 flex justify-between items-center">
                        <span>Secteurs Actifs</span>
                        {isLoading && <LoaderIcon className="w-3 h-3 animate-spin" />}
                    </h3>
                    <ul className="space-y-2">
                        {/* Toutes les enquêtes */}
                        <li>
                            <Link
                                href="/enquetes?reset=1"
                                onClick={onClose}
                                className={`
                                    group w-full flex items-center justify-between font-bold text-sm uppercase py-3 px-4 border-2 transition-all duration-200
                                    ${pathname === '/enquetes' && !searchParams?.get('secteur')
                                        ? 'bg-ink text-paper border-ink shadow-hard translate-x-1 -rotate-1'
                                        : 'bg-paper text-ink border-ink/10 hover:border-ink hover:bg-white hover:shadow-hard-sm hover:-translate-y-0.5'
                                    }
                                `}
                            >
                                <span>Toutes les enquêtes</span>
                                <span className={`w-2 h-2 ${pathname === '/enquetes' && !searchParams?.get('secteur') ? 'bg-lassez-red' : 'bg-ink/20 group-hover:bg-ink'}`} />
                            </Link>
                        </li>

                        {/* Catégories avec articles */}
                        {activeCategories.map((cat: any) => {
                            const path     = `/enquetes?secteur=${cat.slug}`;
                            const isActive = pathname === '/enquetes' && searchParams?.get('secteur') === cat.slug;
                            const count    = countByCatId.get(String(cat.id)) ?? 0;
                            return (
                                <li key={cat.id}>
                                    <Link
                                        href={path}
                                        onClick={onClose}
                                        className={`
                                            group w-full flex items-center justify-between font-bold text-sm uppercase py-3 px-4 border-2 transition-all duration-200
                                            ${isActive
                                                ? 'bg-ink text-paper border-ink shadow-hard translate-x-1 -rotate-1'
                                                : 'bg-paper text-ink border-ink/10 hover:border-ink hover:bg-white hover:shadow-hard-sm hover:-translate-y-0.5'
                                            }
                                        `}
                                    >
                                        <span>{cat.name}</span>
                                        <span className="font-mono text-[10px] opacity-60">
                                            [{count.toString().padStart(2, '0')}]
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}

                        {/* Placeholder pendant le chargement */}
                        {isLoading && activeCategories.length === 0 && (
                            <li className="text-[10px] font-mono text-ink/30 italic py-2">Chargement des secteurs...</li>
                        )}
                    </ul>
                </div>

                {/* Catégories classifiées (sans articles) */}
                {closedCategories.length > 0 && (
                    <div className="opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
                        <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60">
                            Archives (Classifiées)
                        </h3>
                        <ul className="space-y-2 pl-4 border-l-2 border-ink/10">
                            {closedCategories.map((cat: any) => (
                                <li key={cat.id} className="relative">
                                    <span className="text-xs font-serif italic text-ink/60 block py-1">
                                        {cat.name}
                                    </span>
                                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-ink/40" />
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </>
    );
};

export default EnqueteSidebar;
