'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { getNuanceConfig, STATUT_CONFIG, StatutType } from '../lib/election-colors';
import { formatCommuneSlug } from '../lib/seo-engine';

const fetcher = (url: string) => fetch(url).then(r => r.json());

interface Candidat {
    id: number;
    candidat: string;
    nuance: string | null;
    pct: number;
    voix: number;
    statut: StatutType;
    tour_elu?: number;
}

interface TourResult {
    tour: number;
    candidats: Candidat[];
    hasData: boolean;
}

interface VilleResult {
    ville: string;
    tours: TourResult[];
}

interface ApiResponse {
    success: boolean;
    updatedAt: string;
    results: VilleResult[];
}

// ─── Barre de progression d'un candidat ─────────────────────
function CandidatRow({ candidat, maxPct }: { candidat: Candidat; maxPct: number }) {
    const nuance = getNuanceConfig(candidat.nuance);
    const statut = STATUT_CONFIG[candidat.statut] || STATUT_CONFIG.elimine;
    const barWidth = maxPct > 0 ? (candidat.pct / maxPct) * 100 : 0;
    const isEliminated = candidat.statut === 'elimine' || candidat.statut === 'retrait';

    return (
        <div className={`py-3 border-b border-ink/8 last:border-0 ${isEliminated ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-4 mb-2">
                {/* Gauche : infos candidat */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-serif font-black text-base leading-tight text-ink ${isEliminated ? 'line-through decoration-ink/30' : ''}`}>
                            {candidat.candidat}
                        </span>
                        {/* Badge statut */}
                        {candidat.statut === 'elu' ? (
                            <span
                                className="font-mono text-[8px] font-black px-1.5 py-0.5 tracking-widest uppercase bg-green-600 text-white flex items-center gap-1 shadow-sm"
                            >
                                <span className="text-[10px]">★</span> VAINQUEUR
                            </span>
                        ) : (
                            <span
                                className="font-mono text-[8px] font-black px-1.5 py-0.5 tracking-widest uppercase"
                                style={{ backgroundColor: statut.bg, color: statut.text }}
                            >
                                {statut.label}
                            </span>
                        )}
                        {/* Badge nuance */}
                        {candidat.nuance && (
                            <span
                                className="font-mono text-[8px] font-black px-1.5 py-0.5 tracking-wider uppercase border border-ink/10"
                                style={{ backgroundColor: nuance.badge, color: nuance.text }}
                            >
                                {nuance.label}
                            </span>
                        )}
                    </div>
                    {candidat.voix > 0 && (
                        <span className="font-mono text-[9px] text-ink/40 mt-1 block font-bold">
                            {candidat.voix.toLocaleString('fr-FR')} voix • {candidat.pct.toFixed(1)}%
                        </span>
                    )}
                </div>

                {/* Droite : pourcentage */}
                <div className="shrink-0 text-right">
                    <span
                        className="font-serif font-black text-2xl md:text-3xl tabular-nums leading-none"
                        style={{ color: isEliminated ? '#9CA3AF' : nuance.bg }}
                    >
                        {candidat.pct.toFixed(1).replace('.', ',')}
                    </span>
                    <span className="font-mono text-xs text-ink/40 ml-0.5">%</span>
                </div>
            </div>

            {/* Jauge */}
            <div className="h-3 bg-ink/8 w-full overflow-hidden">
                <div
                    className="h-full transition-all duration-700 ease-out"
                    style={{
                        width: `${barWidth}%`,
                        backgroundColor: isEliminated ? '#D1D5DB' : nuance.bg,
                    }}
                />
            </div>
        </div>
    );
}

// ─── Bloc résultats d'une ville ──────────────────────────────
function VilleCard({ ville: villeResult }: { ville: VilleResult }) {
    const [activeTour, setActiveTour] = useState<number>(() => {
        // INTELLIGENCE : Si quelqu'un est élu au T1, on reste sur le T1.
        // Sinon, on affiche le T2 s'il y a des données.
        const eluT1 = villeResult.tours.find(t => t.tour === 1)?.candidats.some(c => c.statut === 'elu');
        if (eluT1) return 1;

        const tour2 = villeResult.tours.find(t => t.tour === 2 && t.hasData);
        if (tour2) return 2;
        
        const toursAvecData = villeResult.tours.filter(t => t.hasData);
        return toursAvecData.length > 0 ? toursAvecData[toursAvecData.length - 1].tour : 1;
    });

    const currentTour = villeResult.tours.find(t => t.tour === activeTour);
    const candidats = currentTour?.candidats || [];
    const maxPct = candidats.length > 0 ? Math.max(...candidats.map(c => c.pct)) : 100;

    return (
        <article className="bg-paper-bright border-2 border-ink shadow-hard overflow-hidden">
            {/* Header ville */}
            <div className="bg-ink text-paper px-5 py-3 flex items-center justify-between">
                <h3 className="font-serif font-black uppercase text-xl md:text-2xl tracking-tighter leading-none">
                    {villeResult.ville}
                </h3>
                {/* Onglets Tour 1 / Tour 2 */}
                <div className="flex border-2 border-paper/20 overflow-hidden">
                    {villeResult.tours.map(tour => (
                        <button
                            key={tour.tour}
                            onClick={() => setActiveTour(tour.tour)}
                            className={`px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-widest transition-all duration-150 ${activeTour === tour.tour
                                ? 'bg-lassez-red text-paper'
                                : tour.hasData
                                    ? 'bg-paper/10 text-paper hover:bg-paper/20'
                                    : 'bg-paper/5 text-paper/30 cursor-not-allowed'
                                }`}
                            disabled={!tour.hasData && activeTour !== tour.tour}
                            title={!tour.hasData ? 'Aucune donnée pour ce tour' : undefined}
                        >
                            T{tour.tour}
                            {tour.candidats.some(c => c.statut === 'elu') && <span className="ml-1 w-2 h-2 bg-yellow-400 rounded-full inline-block align-middle shadow-sm border border-black/10" title="Élection verdict" />}
                            {tour.hasData && !tour.candidats.some(c => c.statut === 'elu') && <span className="ml-1 w-1 h-1 bg-lassez-red rounded-full inline-block align-middle" />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Verdict Global (Si élu) */}
            {villeResult.tours.find(t => t.tour === 1)?.candidats.some(c => c.statut === 'elu') && (
                <div className="bg-yellow-50 border-b-2 border-yellow-200 px-5 py-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black text-yellow-700 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-sm">🏆</span> Élection au 1er tour
                    </span>
                    <span className="font-serif italic text-[10px] text-yellow-600">Majorité absolue atteinte</span>
                </div>
            )}
            {villeResult.tours.find(t => t.tour === 2)?.candidats.some(c => c.statut === 'elu') && (
                <div className="bg-green-50 border-b-2 border-green-200 px-5 py-2 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black text-green-700 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-sm">🗳️</span> Verdict du 2nd tour
                    </span>
                    <span className="font-serif italic text-[10px] text-green-600">Scrutin définitif</span>
                </div>
            )}

            {/* Contenu : candidats ou état vide */}
            <div className="px-5 py-2">
                {currentTour?.hasData ? (
                    <>
                        <div className="font-mono text-[8px] text-ink/30 uppercase tracking-widest py-2 border-b border-ink/10 mb-1">
                            {activeTour === 1 ? 'RÉSULTATS DÉFINITIFS — 1er TOUR' : 'RÉSULTATS DÉFINITIFS — 2e TOUR'}
                        </div>
                        {candidats.map(candidat => (
                            <CandidatRow
                                key={candidat.id}
                                candidat={candidat}
                                maxPct={maxPct}
                            />
                        ))}
                    </>
                ) : (
                    <div className="py-8 text-center">
                        <div className="font-mono text-[10px] text-ink/30 uppercase tracking-widest">
                            {activeTour === 2 ? '2nd Tour — En attente' : 'Données non disponibles'}
                        </div>
                    </div>
                )}
            </div>
        </article>
    );
}

// ─── Composant principal ─────────────────────────────────────
export default function ElectionResultsLive({ 
    electionSlug = 'municipales-2026',
    initialVille = '',
    initialDep = ''
}: { 
    electionSlug?: string;
    initialVille?: string;
    initialDep?: string;
}) {
    const [search, setSearch] = useState(initialVille);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const router = (typeof window !== 'undefined') ? require('next/navigation').useRouter() : null;

    // Debounce pour l'autocomplete
    React.useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 300);
        return () => clearTimeout(timer);
    }, [search]);

    // Fetch des suggestions (Autocomplete)
    const { data: suggestData } = useSWR<{ success: boolean; suggestions: { name: string; slug: string; dep: string; insee: string }[] }>(
        search.length >= 2 ? `/api/elections/results?slug=${electionSlug}&suggest=${encodeURIComponent(search)}` : null,
        fetcher
    );

    // Fetch des résultats finaux
    const { data, error, isLoading } = useSWR<ApiResponse>(
        `/api/elections/results?slug=${electionSlug}${initialVille ? `&ville=${encodeURIComponent(initialVille)}` : ''}${initialDep ? `&dep=${encodeURIComponent(initialDep)}` : ''}`,
        fetcher,
        {
            refreshInterval: initialVille ? 60_000 : 30_000,
            revalidateOnFocus: false,
            keepPreviousData: true,
        }
    );

    const results = data?.results || [];
    const hasData = results.length > 0;
    const suggestions = suggestData?.suggestions || [];

    const handleSelectVille = (ville: string, slug: string, dep?: string, insee?: string) => {
        setSearch(ville);
        setShowSuggestions(false);
        if (router) {
            // Nouveau format de Silo SEO : /elections/municipales-2026/commune/[code-insee]-[nom-ville]
            const finalSlug = insee ? formatCommuneSlug(insee, ville) : slug;
            const url = `/elections/${electionSlug}/commune/${finalSlug}`;
            router.push(url);
        }
    };

    return (
        <div className="w-full">
            {/* En-tête section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b-4 border-ink pb-3">
                <div className="flex items-center gap-3">
                    <h2 className="font-serif font-black uppercase text-xl md:text-2xl tracking-tighter text-ink">
                        {initialVille ? `Résultats à ${initialVille}` : <>Résultats <span className="text-lassez-red">Définitifs</span></>}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    <span className="font-mono text-[8px] bg-ink text-paper px-2 py-1 font-black uppercase tracking-widest">
                        2nd Tour Terminé
                    </span>
                </div>
            </div>

            {/* Barre de Recherche avec Autocomplete */}
            <div className="mb-10 relative group z-40">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="RECHERCHER VOTRE VILLE (ex: Paris, Nantes, Nice...)"
                        value={search}
                        onFocus={() => setShowSuggestions(true)}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setShowSuggestions(true);
                        }}
                        className="w-full bg-paper border-2 border-ink px-4 py-3 font-mono text-sm uppercase font-black tracking-widest placeholder:text-ink/20 focus:outline-none focus:ring-4 focus:ring-lassez-red/10 transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] group-hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink/30 pointer-events-none uppercase">
                        INDEX: 35K CITIES
                    </div>
                </div>

                {/* Dropdown Suggestions */}
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-paper border-2 border-ink shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-h-60 overflow-y-auto">
                        {suggestions.map((s) => (
                            <button
                                key={`${s.slug}-${s.dep}`}
                                onClick={() => handleSelectVille((s as any).ville || s.name, s.slug, s.dep, (s as any).insee)}
                                className="w-full text-left px-4 py-3 border-b border-ink/10 hover:bg-lassez-red hover:text-paper transition-colors font-mono text-xs font-black uppercase tracking-wider"
                            >
                                {s.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Erreur API */}
            {error && (
                <div className="border-2 border-lassez-red p-4 mb-6 bg-lassez-red/5 shadow-hard">
                    <p className="font-mono text-[10px] text-lassez-red font-black uppercase">
                        Erreur de connexion au flux — Nouvelle tentative dans 30s
                    </p>
                </div>
            )}

            {/* Skeleton */}
            {isLoading && !hasData && (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="border-2 border-ink/10 h-48 animate-pulse bg-ink/5" />
                    ))}
                </div>
            )}

            {/* Résultats par ville */}
            {hasData && (
                <div className="space-y-6">
                    {results.map(ville => (
                        <VilleCard key={ville.ville} ville={ville} />
                    ))}
                </div>
            )}

            {/* État vide */}
            {!isLoading && !hasData && !error && (
                <div className="border-2 border-dashed border-ink/20 p-10 text-center">
                    <div className="text-3xl mb-4">🗳</div>
                    <p className="font-serif font-black uppercase text-sm text-ink/40">
                        {search ? "Aucune donnée disponible pour cette recherche" : "Sélectionnez une ville pour voir les résultats"}
                    </p>
                </div>
            )}
        </div>
    );
}
