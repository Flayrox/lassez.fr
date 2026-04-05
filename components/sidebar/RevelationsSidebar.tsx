'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoaderIcon, GlobeIcon, MapPinIcon, ShieldIcon } from '../icons';

interface WPTag {
    id: number;
    name: string;
    slug: string;
    count: number;
}

interface RevelationsSidebarProps {
    onClose: () => void;
}

const RevelationsSidebar: React.FC<RevelationsSidebarProps> = ({ onClose }) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    
    const [wpTags, setWpTags] = useState<WPTag[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(true);

    const currentGeo = searchParams?.get('geo') || 'all';
    const currentTag = searchParams?.get('tag') || null;

    useEffect(() => {
        async function fetchTags() {
            try {
                setIsLoadingTags(true);
                const res = await fetch('https://api.lassez.fr/wp-json/wp/v2/tags?per_page=30&orderby=count&order=desc');
                if (res.ok) {
                    const tags = await res.json();
                    setWpTags(tags.filter((t: WPTag) => t.count > 0));
                }
            } catch (error) {
                console.error('Error fetching tags:', error);
            } finally {
                setIsLoadingTags(false);
            }
        }
        fetchTags();
    }, []);

    const updateFilters = (geo: string | null, tag: string | null) => {
        const params = new URLSearchParams(searchParams?.toString());
        
        if (geo) {
            if (geo === 'all') params.delete('geo');
            else params.set('geo', geo);
        }
        
        if (tag !== undefined) {
            if (tag === null) params.delete('tag');
            else params.set('tag', tag);
        }

        router.push(`/revelations?${params.toString()}`);
        onClose();
    };

    const geoFilters = [
        { id: 'all', label: 'Global', icon: GlobeIcon },
        { id: 'france', label: 'France', icon: MapPinIcon },
        { id: 'international', label: 'International', icon: ShieldIcon },
    ];

    return (
        <>
            <div className="hidden lg:flex p-6 border-b-4 border-ink bg-ink/5 items-center justify-between">
                <h2 className="font-black uppercase text-xl tracking-tighter text-ink">Révélations</h2>
                <div className="w-3 h-3 bg-lassez-red rounded-full animate-pulse"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {/* Geo Filters */}
                <div className="mb-10 lg:mb-8">
                    <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60 flex justify-between items-center">
                        <span>Zone Radar</span>
                    </h3>
                    <ul className="space-y-2">
                        {geoFilters.map((filter) => {
                            const isActive = currentGeo === filter.id;
                            const Icon = filter.icon;
                            return (
                                <li key={filter.id}>
                                    <button
                                        onClick={() => updateFilters(filter.id, undefined)}
                                        className={`
                                            group w-full flex items-center justify-between font-bold text-sm uppercase py-3 px-4 border-2 transition-all duration-200
                                            ${isActive
                                                ? 'bg-ink text-paper border-ink shadow-hard translate-x-1 -rotate-1'
                                                : 'bg-paper text-ink border-ink/10 hover:border-ink hover:bg-white hover:shadow-hard-sm hover:-translate-y-0.5'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Icon className={`w-4 h-4 ${isActive ? 'text-lassez-red' : 'text-ink/40 group-hover:text-ink'}`} />
                                            <span>{filter.label}</span>
                                        </div>
                                        <span className={`w-2 h-2 ${isActive ? 'bg-lassez-red' : 'bg-ink/20 group-hover:bg-ink'}`}></span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Tag Filters */}
                <div className="mb-10 lg:mb-8">
                    <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60 flex justify-between items-center">
                        <span>Signaux Clés</span>
                        {isLoadingTags && <LoaderIcon className="w-3 h-3 animate-spin" />}
                    </h3>
                    
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => updateFilters(undefined, null)}
                            className={`
                                px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-2
                                ${!currentTag
                                    ? 'bg-ink text-paper border-ink shadow-hard'
                                    : 'bg-paper text-ink border-ink/10 hover:border-ink hover:bg-white hover:shadow-hard-sm'
                                }
                            `}
                        >
                            Tous
                        </button>
                        {wpTags.slice(0, 15).map((tag) => {
                            const isActive = currentTag === tag.slug;
                            return (
                                <button
                                    key={tag.id}
                                    onClick={() => updateFilters(undefined, isActive ? null : tag.slug)}
                                    className={`
                                        px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all border-2
                                        ${isActive
                                            ? 'bg-ink text-paper border-ink shadow-hard'
                                            : 'bg-paper text-ink border-ink/10 hover:border-ink hover:bg-white hover:shadow-hard-sm'
                                        }
                                    `}
                                >
                                    {tag.name}
                                    <span className="ml-1 opacity-50 font-mono">[{tag.count}]</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-12 pt-6 border-t border-ink/10">
                    <div className="text-[10px] font-mono text-ink/40 uppercase leading-relaxed">
                        CANAL_SÉCURISÉ_V3.8<br />
                        FLUX_TEMPS_RÉEL_ACTIF<br />
                        DERNIÈRE_SYNCHRO: {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>
        </>
    );
};

export default RevelationsSidebar;
