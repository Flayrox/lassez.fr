'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LoaderIcon, GlobeIcon, MapPinIcon, ShieldIcon } from '../icons';
import type { Tag } from '../../payload-types';

interface RevelationsSidebarProps {
    onClose: () => void;
}

const RevelationsSidebar: React.FC<RevelationsSidebarProps> = ({ onClose }) => {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [tags, setTags] = useState<Tag[]>([]);
    const [isLoadingTags, setIsLoadingTags] = useState(true);
    const [lastSyncTime, setLastSyncTime] = useState<string>('');

    const currentGeo = searchParams?.get('geo') || 'all';
    const currentTag = searchParams?.get('tag') || null;

    // Fetch tags depuis l'API Payload native
    useEffect(() => {
        setIsLoadingTags(true);
        fetch('/api/tags?per_page=50&orderby=name&order=asc')
            .then(r => r.json())
            .then(data => {
                // L'API renvoie soit un tableau direct, soit { docs: [...] }
                const list = Array.isArray(data) ? data : (data?.docs ?? []);
                setTags(list);
            })
            .catch(() => setTags([]))
            .finally(() => setIsLoadingTags(false));
    }, []);

    useEffect(() => {
        setLastSyncTime(new Date().toLocaleTimeString());
    }, []);

    const updateFilters = (geo: string | null | undefined, tag: string | null | undefined) => {
        const params = new URLSearchParams(searchParams?.toString());

        if (geo !== undefined) {
            if (geo === 'all' || !geo) params.delete('geo');
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
        { id: 'all',           label: 'Global',        icon: GlobeIcon },
        { id: 'france',        label: 'France',        icon: MapPinIcon },
        { id: 'international', label: 'International', icon: ShieldIcon },
    ];

    return (
        <>
            {/* Desktop Title */}
            <div className="hidden lg:flex p-6 border-b-4 border-ink bg-ink/5 items-center justify-between">
                <h2 className="font-black uppercase text-xl tracking-tighter text-ink">Révélations</h2>
                <div className="w-3 h-3 bg-lassez-red rounded-full animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {/* Zone Radar (Géo) */}
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
                                        <span className={`w-2 h-2 ${isActive ? 'bg-lassez-red' : 'bg-ink/20 group-hover:bg-ink'}`} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>

                {/* Signaux Clés — Thématiques (tags) */}
                <div className="mb-10 lg:mb-8">
                    <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60 flex justify-between items-center">
                        <span>Signaux Clés — Thématiques</span>
                        {isLoadingTags && <LoaderIcon className="w-3 h-3 animate-spin" />}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                        {/* Reset tag */}
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

                        {tags.map((tag: any) => {
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
                                </button>
                            );
                        })}

                        {!isLoadingTags && tags.length === 0 && (
                            <span className="text-[9px] font-mono text-ink/30 italic">Aucun tag disponible</span>
                        )}
                    </div>
                </div>

                {/* Footer info */}
                <div className="mt-12 pt-6 border-t border-ink/10">
                    <div className="text-[10px] font-mono text-ink/40 uppercase leading-relaxed">
                        CANAL_SÉCURISÉ_V4.0<br />
                        FLUX_TEMPS_RÉEL_ACTIF<br />
                        DERNIÈRE_SYNCHRO: {lastSyncTime || '--:--:--'}
                    </div>
                </div>
            </div>
        </>
    );
};

export default RevelationsSidebar;
