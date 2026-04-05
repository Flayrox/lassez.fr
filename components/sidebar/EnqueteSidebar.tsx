'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LoaderIcon } from '../icons';
import { useCategories } from '../../hooks/useCategories';

interface EnqueteSidebarProps {
    onClose: () => void;
}

const TARGET_CATEGORY_IDS = [3, 4, 5, 6, 7, 8, 9];

const EnqueteSidebar: React.FC<EnqueteSidebarProps> = ({ onClose }) => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { categories, isLoading } = useCategories();

    const { activeCategories, closedCategories } = useMemo(() => {
        const filtered = categories.filter(cat => TARGET_CATEGORY_IDS.includes(cat.id));
        const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));

        return {
            activeCategories: sorted.filter(cat => cat.count > 0),
            closedCategories: sorted.filter(cat => cat.count === 0)
        };
    }, [categories]);

    return (
        <>
            {/* Desktop Title Area */}
            <div className="hidden lg:flex p-6 border-b-4 border-ink bg-ink/5 items-center justify-between">
                <h2 className="font-black uppercase text-xl tracking-tighter text-ink">Enquêtes</h2>
                <div className="w-3 h-3 bg-lassez-red rounded-full animate-pulse"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="mb-10 lg:mb-8">
                    <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60 flex justify-between items-center">
                        <span>Secteurs Actifs</span>
                        {isLoading && <LoaderIcon className="w-3 h-3 animate-spin" />}
                    </h3>
                    <ul className="space-y-2">
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
                                <span className={`w-2 h-2 ${pathname === '/enquetes' && !searchParams?.get('secteur') ? 'bg-lassez-red' : 'bg-ink/20 group-hover:bg-ink'}`}></span>
                            </Link>
                        </li>
                        {activeCategories.map((cat) => {
                            const path = `/enquetes?secteur=${cat.slug}`;
                            const isActive = pathname === '/enquetes' && searchParams?.get('secteur') === cat.slug;
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
                                        <span className="font-mono text-[10px] opacity-60">[{cat.count.toString().padStart(2, '0')}]</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {closedCategories.length > 0 && (
                    <div className="opacity-50 grayscale hover:grayscale-0 transition-all duration-300">
                        <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60">Archives (Classifiées)</h3>
                        <ul className="space-y-2 pl-4 border-l-2 border-ink/10">
                            {closedCategories.map((cat) => (
                                <li key={cat.id} className="relative">
                                    <span className="text-xs font-serif italic text-ink/60 block py-1">
                                        {cat.name}
                                    </span>
                                    <div className="absolute top-1/2 left-0 w-full h-[1px] bg-ink/40"></div>
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
