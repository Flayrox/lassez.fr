'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { usePathname } from 'next/navigation';
import { regions, departments } from '../../lib/geo-data';
import { formatCommuneSlug } from '../../lib/seo-engine';
import { formatElectionLabel } from '../../lib/elections';
import { ChevronLeftIcon, SearchIcon } from '../icons';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface ElectionsSidebarProps {
    onClose: () => void;
}

const MapIcon = ({ className }: { className?: string }) => (
    <svg 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon>
        <line x1="8" y1="2" x2="8" y2="18"></line>
        <line x1="16" y1="6" x2="16" y2="22"></line>
    </svg>
);

const TOP_CITIES = [
    { name: 'Paris', dept: '75' },
    { name: 'Marseille', dept: '13' },
    { name: 'Lyon', dept: '69' },
    { name: 'Toulouse', dept: '31' },
    { name: 'Nice', dept: '06' },
    { name: 'Nantes', dept: '44' },
    { name: 'Montpellier', dept: '34' },
    { name: 'Strasbourg', dept: '67' },
];

const ElectionsSidebar: React.FC<ElectionsSidebarProps> = ({ onClose }) => {
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [selectedDept, setSelectedDept] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const pathname = usePathname();

    const electionSlug = useMemo(() => {
        const match = String(pathname || '').match(/^\/elections\/([^\/]+)/);
        return match?.[1] || 'municipales-2026';
    }, [pathname]);

    const { data, isLoading } = useSWR(
        selectedDept ? `/api/elections/results?slug=${encodeURIComponent(electionSlug)}&list_cities=1&dep=${selectedDept}` : null,
        fetcher
    );
    const { data: electionsMeta } = useSWR('/api/elections/meta', fetcher);
    const electionChoices = Array.isArray(electionsMeta?.elections) ? electionsMeta.elections : [];

    const filteredCities = useMemo(() => {
        if (!data?.cities) return [];
        if (!searchTerm) return data.cities;
        const lowerSearch = searchTerm.toLowerCase();
        return data.cities.filter((city: { ville: string }) => 
            city.ville.toLowerCase().includes(lowerSearch)
        );
    }, [data?.cities, searchTerm]);

    const regionData = useMemo(() => {
        if (!selectedRegion) return null;
        return regions.find(r => r.name === selectedRegion);
    }, [selectedRegion]);

    const handleBackToRegions = () => {
        setSelectedRegion(null);
        setSelectedDept(null);
        setSearchTerm('');
    };

    const handleBackToDepts = () => {
        setSelectedDept(null);
        setSearchTerm('');
    };

    return (
        <>
            {/* Desktop Title Area */}
            <div className="hidden lg:flex p-6 border-b-4 border-ink bg-ink/5 items-center justify-between">
                <h2 className="font-black uppercase text-xl tracking-tighter text-ink">Élections</h2>
                <div className="w-3 h-3 bg-lassez-red rounded-full animate-pulse"></div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {/* Map Block */}
                <div className="mb-8">
                    <Link
                        href={`/elections/${electionSlug}`}
                        onClick={onClose}
                        className="group block relative aspect-video bg-ink border-2 border-ink overflow-hidden shadow-hard hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
                    >
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-40 transition-opacity">
                            <MapIcon className="w-24 h-24 text-paper" />
                        </div>
                        <div className="absolute inset-0 p-4 flex flex-col justify-end bg-gradient-to-t from-ink to-transparent">
                            <span className="font-mono text-[10px] uppercase tracking-widest text-paper/60 mb-1">Carte Interactive</span>
                            <span className="font-black text-lg uppercase text-paper leading-none">{formatElectionLabel(electionSlug)}</span>
                        </div>
                    </Link>
                </div>

                {!selectedRegion && electionChoices.length > 1 && (
                    <div className="mb-8">
                        <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60">
                            Scrutin Actif
                        </h3>
                        <div className="space-y-2">
                            {electionChoices.map((item: { slug: string; label: string; isTarget?: boolean; counts?: { communes?: number; departments?: number } }) => {
                                const isCurrent = item.slug === electionSlug;
                                const communes = Number(item.counts?.communes || 0);
                                return (
                                    <Link
                                        key={item.slug}
                                        href={`/elections/${item.slug}`}
                                        onClick={onClose}
                                        className={`flex items-center justify-between px-3 py-2 border-2 font-black text-[10px] uppercase tracking-wider transition-all ${
                                            isCurrent
                                                ? 'border-lassez-red bg-lassez-red text-paper'
                                                : 'border-ink/10 bg-paper text-ink hover:border-ink hover:bg-white'
                                        }`}
                                    >
                                        <span>{item.label || formatElectionLabel(item.slug)}</span>
                                        <div className="flex items-center gap-1">
                                            {communes > 0 && (
                                                <span className={`font-mono text-[8px] px-1.5 py-0.5 border ${isCurrent ? 'border-paper/50' : 'border-ink/30'}`}>
                                                    {communes}
                                                </span>
                                            )}
                                            {item.isTarget && (
                                                <span className={`font-mono text-[8px] px-1.5 py-0.5 border ${isCurrent ? 'border-paper/50' : 'border-ink/30'}`}>
                                                    ANALYSE
                                                </span>
                                            )}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Drill-down Menus */}
                <div className="mb-8">
                    <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60 flex justify-between items-center">
                        <span>Exploration Locale</span>
                    </h3>

                    {!selectedRegion ? (
                        <ul className="space-y-2">
                            {regions.map((region) => (
                                <li key={region.name}>
                                    <button
                                        onClick={() => setSelectedRegion(region.name)}
                                        className="group w-full flex items-center justify-between font-bold text-sm uppercase py-3 px-4 border-2 border-ink/10 bg-paper text-ink hover:border-ink hover:bg-white hover:shadow-hard-sm hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        <span>{region.name}</span>
                                        <span className="font-mono text-[10px] opacity-40 group-hover:opacity-100">→</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : !selectedDept ? (
                        <div>
                            <button
                                onClick={handleBackToRegions}
                                className="flex items-center gap-2 font-mono text-[10px] uppercase text-ink/60 hover:text-ink mb-4 transition-colors"
                            >
                                <ChevronLeftIcon className="w-3 h-3" />
                                Retour aux régions
                            </button>
                            <h4 className="font-black text-sm uppercase mb-4 px-2 border-l-4 border-lassez-red pl-3">{selectedRegion}</h4>
                            <ul className="grid grid-cols-1 gap-2">
                                {regionData?.depts.map((deptCode) => (
                                    <li key={deptCode}>
                                        <button
                                            onClick={() => {
                                                setSelectedDept(deptCode);
                                                setSearchTerm('');
                                            }}
                                            className="group w-full flex items-center justify-between font-bold text-sm uppercase py-3 px-4 border-2 border-ink/10 bg-paper text-ink hover:border-ink hover:bg-white hover:shadow-hard-sm hover:-translate-y-0.5 transition-all duration-200"
                                        >
                                            <span>{departments[deptCode]}</span>
                                            <span className="font-mono text-[10px] opacity-40 group-hover:opacity-100">[{deptCode}]</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div>
                            <button
                                onClick={handleBackToDepts}
                                className="flex items-center gap-2 font-mono text-[10px] uppercase text-ink/60 hover:text-ink mb-4 transition-colors"
                            >
                                <ChevronLeftIcon className="w-3 h-3" />
                                Retour aux départements
                            </button>
                            <h4 className="font-black text-sm uppercase mb-4 px-2 border-l-4 border-lassez-red pl-3">{departments[selectedDept]}</h4>
                            <div className="space-y-4">
                                <Link
                                    href={`/elections/${electionSlug}/departement/${selectedDept}`}
                                    onClick={onClose}
                                    className="block w-full text-center font-black text-sm uppercase py-4 px-4 bg-ink text-paper border-2 border-ink shadow-hard hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all duration-200"
                                >
                                    Consulter le département
                                </Link>
                                <div className="flex flex-col border-2 border-ink bg-paper overflow-hidden">
                                    <div className="p-2 border-b-2 border-ink bg-ink/5 relative">
                                        <input 
                                            type="text" 
                                            placeholder="Filtrer les communes..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="w-full bg-transparent p-1 pl-7 text-[10px] font-bold uppercase focus:outline-none"
                                        />
                                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-ink/40" />
                                    </div>
                                    
                                    <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                        {isLoading ? (
                                            <div className="p-4 text-center font-mono text-[10px] uppercase text-ink/40 animate-pulse">
                                                Chargement...
                                            </div>
                                        ) : filteredCities.length > 0 ? (
                                            <ul className="divide-y divide-ink/10">
                                                {filteredCities.map((city: { ville: string, code_insee: string }) => (
                                                    <li key={city.code_insee}>
                                                        <Link
                                                            href={`/elections/${electionSlug}/commune/${formatCommuneSlug(city.code_insee, city.ville)}`}
                                                            onClick={onClose}
                                                            className="block px-4 py-2 text-[11px] font-bold uppercase hover:bg-lassez-red hover:text-paper transition-colors"
                                                        >
                                                            {city.ville}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <div className="p-4 text-center font-mono text-[10px] uppercase text-ink/40">
                                                Aucune commune trouvée
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Top Cities */}
                {!selectedRegion && (
                    <div className="mb-8">
                        <h3 className="font-bold font-mono uppercase tracking-widest text-[10px] mb-4 border-b-2 border-ink/20 pb-2 text-ink/60">
                            Villes Stratégiques
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            {TOP_CITIES.map((city) => (
                                <Link
                                    key={city.name}
                                    href={`/elections/${electionSlug}?ville=${encodeURIComponent(city.name)}&dep=${encodeURIComponent(city.dept)}`}
                                    onClick={onClose}
                                    className="font-bold text-[11px] uppercase p-2 border border-ink/10 hover:border-ink hover:bg-white transition-all text-center"
                                >
                                    {city.name}
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* SEO / Structural Links */}
                <div className="mt-auto pt-8 border-t border-ink/10">
                    <p className="text-[9px] font-mono uppercase text-ink/40 leading-relaxed">
                        Données électorales consolidées par le Radar Lassez. 
                        Mise à jour en temps réel des candidatures et scrutins.
                        © 2024 Lassez-Faire.
                    </p>
                </div>
            </div>
        </>
    );
};

export default ElectionsSidebar;
