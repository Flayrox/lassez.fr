'use client';

import React, { useState } from 'react';
import ElectionResultsLive from './ElectionResultsLive';
import Link from 'next/link';
import { WPPost } from '../types';
import { getArticleUrl } from '../lib/getArticleUrl';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { regions, departments as deptNames } from '../lib/geo-data';
import { formatCommuneSlug } from '../lib/seo-engine';
import { formatElectionLabel } from '../lib/elections';

interface ElectionsClientProps {
    electionSlug: string;
    articles: WPPost[];
    departments?: string[];
    initialVille?: string;
    initialDep?: string;
}

export default function ElectionsClient({ electionSlug, articles, departments = [], initialVille = '', initialDep = '' }: ElectionsClientProps) {
    const [expandedRegion, setExpandedRegion] = useState<string | null>(null);

    const electionLabel = formatElectionLabel(electionSlug);

    const toggleRegion = (regionName: string) => {
        setExpandedRegion(expandedRegion === regionName ? null : regionName);
    };

    // Filter departments that actually have data (if provided)
    const availableDepts = new Set(departments);

    const importantVilles = [
        { name: 'Paris', insee: '7575056' },
        { name: 'Marseille', insee: '1313055' },
        { name: 'Lyon', insee: '6969123' },
        { name: 'Toulouse', insee: '3131555' },
        { name: 'Nice', insee: '0606088' },
        { name: 'Nantes', insee: '4444109' },
        { name: 'Montpellier', insee: '3434172' },
        { name: 'Strasbourg', insee: '6767482' },
        { name: 'Bordeaux', insee: '3333063' },
        { name: 'Lille', insee: '5959350' },
        { name: 'Rennes', insee: '3535238' },
        { name: 'Toulon', insee: '8383137' },
        { name: 'Grenoble', insee: '3838185' },
        { name: 'Dijon', insee: '2121231' },
    ];

    return (
        <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-12">

            {/* Intro */}
            <div className="border-b-4 border-ink pb-4">
                <div className="flex items-center gap-3 mb-2">
                    <span className="font-mono text-[9px] font-black uppercase tracking-widest bg-ink text-paper px-2 py-1">
                        RÉSULTATS DÉFINITIFS
                    </span>
                    <span className="font-mono text-[9px] text-ink/40 uppercase tracking-widest">
                        Scrutin terminé
                    </span>
                </div>
                <h1 className="font-serif font-black text-3xl md:text-5xl uppercase tracking-tighter text-ink leading-none">
                    Élections<br />
                    <span className="text-lassez-red">{electionLabel}</span>
                </h1>
                <p className="mt-3 font-serif text-ink/70 text-base md:text-lg max-w-2xl">
                    Découvrez les résultats définitifs du scrutin {electionLabel}. Données issues des flux officiels de l'Etat, consolidées par la rédaction.
                </p>
            </div>

            {/* Résultats live */}
            <ElectionResultsLive electionSlug={electionSlug} initialVille={initialVille} initialDep={initialDep} />

            {/* Navigation par Région & Département */}
            <div className="border-t-4 border-ink pt-4">
                <h2 className="font-serif font-black uppercase text-xl md:text-2xl tracking-tighter text-ink mb-6">
                    Explorer par <span className="text-lassez-red">Territoire</span>
                </h2>
                
                <div className="space-y-4">
                    {regions.map(region => (
                        <div key={region.name} className="border-2 border-ink bg-paper-bright overflow-hidden shadow-hard-sm">
                            <button 
                                onClick={() => toggleRegion(region.name)}
                                className="w-full flex items-center justify-between px-6 py-4 bg-paper hover:bg-ink hover:text-paper transition-all group"
                            >
                                <span className="font-serif font-black uppercase text-lg md:text-xl tracking-tight">
                                    {region.name}
                                </span>
                                <span className={`font-mono text-xl transition-transform duration-300 ${expandedRegion === region.name ? 'rotate-180' : ''}`}>
                                    {expandedRegion === region.name ? '−' : '+'}
                                </span>
                            </button>
                            
                            {expandedRegion === region.name && (
                                <div className="p-4 bg-paper/50 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 border-t-2 border-ink">
                                    {region.depts.map(deptCode => {
                                        const name = deptNames[deptCode] || deptCode;
                                        const hasData = availableDepts.has(deptCode);
                                        return (
                                            <Link
                                                key={deptCode}
                                                href={`/elections/${electionSlug}/departement/${deptCode}`}
                                                className={`flex flex-col items-center justify-center p-3 border-2 transition-all hover:-translate-y-1 hover:-translate-x-1 hover:shadow-hard-sm ${
                                                    hasData 
                                                    ? 'border-ink bg-white font-mono text-xs font-black' 
                                                    : 'border-ink/10 text-ink/30 cursor-not-allowed pointer-events-none'
                                                }`}
                                            >
                                                <span className="text-lassez-red text-[10px]">{deptCode}</span>
                                                <span className="uppercase text-center leading-none mt-1">{name}</span>
                                            </Link>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Articles liés */}
            {articles.length > 0 && (
                <div>
                    <div className="flex items-center gap-4 mb-6 border-t-4 border-ink pt-4">
                        <h2 className="font-serif font-black uppercase text-xl md:text-2xl tracking-tighter text-ink">
                            Nos <span className="text-lassez-red">Analyses</span>
                        </h2>
                        <div className="h-[2px] flex-grow bg-ink/10" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {articles.map(post => {
                            const imageUrl = post._embedded?.['wp:featuredmedia']?.[0]?.source_url;
                            const author = post._embedded?.author?.[0]?.name || 'Rédaction';
                            return (
                                <Link
                                    key={post.id}
                                    href={getArticleUrl(post)}
                                    className="group block bg-paper-bright border-2 border-ink hover:shadow-hard transition-all duration-200 hover:-translate-y-1 hover:-translate-x-1"
                                >
                                    {imageUrl && (
                                        <div className="h-36 overflow-hidden border-b-2 border-ink">
                                            <img
                                                src={imageUrl}
                                                alt={post.title.rendered}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        </div>
                                    )}
                                    <div className="p-4">
                                        <div className="font-mono text-[9px] text-ink/40 uppercase font-black mb-2">
                                            {format(new Date(post.date), 'dd.MM.yyyy', { locale: fr })} — {author.toUpperCase()}
                                        </div>
                                        <h3
                                            className="font-serif font-black text-sm uppercase leading-tight text-ink group-hover:underline decoration-lassez-red decoration-2 underline-offset-4"
                                            dangerouslySetInnerHTML={{ __html: post.title.rendered }}
                                        />
                                        <div
                                            className="font-serif text-xs text-ink/60 line-clamp-2 italic mt-2"
                                            dangerouslySetInnerHTML={{ __html: post.excerpt.rendered.replace(/<[^>]+>/g, '') }}
                                        />
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Navigation SEO interne */}
            <div className="border-t-2 border-ink/10 pt-8 pb-4">
                <h2 className="font-serif font-black uppercase text-xs tracking-widest text-ink/40 mb-4">
                    Villes <span className="text-lassez-red">recherchées</span>
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {importantVilles.map(v => (
                        <Link 
                            key={v.insee}
                            href={`/elections/${electionSlug}/commune/${formatCommuneSlug(v.insee, v.name)}`}
                            className="font-mono text-[9px] font-black uppercase tracking-tight text-ink/50 hover:text-lassez-red transition-colors"
                        >
                            {v.name}
                        </Link>
                    ))}
                </div>
            </div>

            {articles.length === 0 && (
                <div className="border-t-4 border-ink pt-4">
                    <h2 className="font-serif font-black uppercase text-xl tracking-tighter text-ink/30 mb-2">
                        Analyses & Décryptages
                    </h2>
                    <p className="font-mono text-[10px] text-ink/20 uppercase">
                        Les articles de la rédaction apparaîtront ici au fil du scrutin.
                    </p>
                </div>
            )}
        </div>
    );
}
