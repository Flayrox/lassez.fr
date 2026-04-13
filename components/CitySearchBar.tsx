'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { formatCommuneSlug } from '../lib/seo-engine';
import { SearchIcon } from './icons';

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function CitySearchBar({ electionSlug = 'municipales-2026' }: { electionSlug?: string }) {
    const [search, setSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const router = useRouter();

    const { data: suggestData } = useSWR<{ success: boolean; suggestions: { name: string; slug: string; dep: string; insee: string }[] }>(
        search.length >= 2 ? `/api/elections/results?slug=${electionSlug}&suggest=${encodeURIComponent(search)}` : null,
        fetcher
    );

    const suggestions = suggestData?.suggestions || [];

    const handleSelectVille = (ville: string, slug: string, insee?: string, dep?: string) => {
        setSearch(ville);
        setShowSuggestions(false);
        if (electionSlug === 'municipales-2026') {
            const finalSlug = insee ? formatCommuneSlug(insee, ville) : slug;
            router.push(`/elections/${electionSlug}/commune/${finalSlug}`);
            return;
        }

        let url = `/elections/${electionSlug}?ville=${encodeURIComponent(ville)}`;
        if (dep) {
            url += `&dep=${encodeURIComponent(dep)}`;
        }
        router.push(url);
    };

    return (
        <div className="relative z-50">
            <div className="relative group">
                <input
                    type="text"
                    placeholder="RECHERCHER UNE AUTRE VILLE..."
                    value={search}
                    onFocus={() => setShowSuggestions(true)}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setShowSuggestions(true);
                    }}
                    className="w-full bg-paper border-2 border-ink px-4 py-3 font-mono text-sm uppercase font-black tracking-widest placeholder:text-ink/20 focus:outline-none focus:ring-4 focus:ring-lassez-red/10 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                    <SearchIcon className="w-5 h-5 text-ink/20 group-hover:text-lassez-red transition-colors" />
                </div>
            </div>

            {/* Dropdown Suggestions */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-1 bg-paper border-2 border-ink shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-60 overflow-y-auto">
                    {suggestions.map((s) => (
                        <button
                            key={`${s.slug}-${s.dep}`}
                            onClick={() => handleSelectVille(s.name.split(' (')[0], s.slug, s.insee, s.dep)}
                            className="w-full text-left px-4 py-3 border-b border-ink/10 hover:bg-lassez-red hover:text-paper transition-colors font-mono text-xs font-black uppercase tracking-wider"
                        >
                            {s.name}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
