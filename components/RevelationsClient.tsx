'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AlertTriangleIcon, LoaderIcon, ChevronUpIcon } from './icons';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { Revelation, Tag } from '../payload-types';

interface PayloadResult { docs: Revelation[]; totalDocs: number; hasNextPage: boolean; }
type GeoFilter = 'all' | 'france' | 'international';

function safeDate(raw?: string | null): Date | null {
    if (!raw) return null;
    try { const d = parseISO(raw); return isValid(d) ? d : null; } catch { return null; }
}
function stripHtml(html: string) { return html.replace(/<[^>]+>/g, '').trim(); }

// ─── Sidebar ──────────────────────────────────────────────────────────────────
interface SidebarProps {
    geoFilter: GeoFilter;
    activeTag: string | null;
    allTags: Tag[];
    totalDocs: number;
    onGeo(g: GeoFilter): void;
    onTag(slug: string | null): void;
}
function Sidebar({ geoFilter, activeTag, allTags, totalDocs, onGeo, onTag }: SidebarProps) {
    const geoOptions: { value: GeoFilter; label: string; flag: string }[] = [
        { value: 'all',           label: 'Global',        flag: '🌍' },
        { value: 'france',        label: 'France',        flag: '🇫🇷' },
        { value: 'international', label: 'International', flag: '🌐' },
    ];
    return (
        <aside className="w-full lg:w-64 lg:flex-shrink-0">
            <div className="lg:sticky lg:top-28 space-y-6">
                {/* Header admin */}
                <div className="bg-black text-white p-4 shadow-hard">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full bg-lassez-red animate-pulse block" />
                        <span className="font-mono font-black text-[10px] uppercase tracking-widest text-lassez-red">En Direct</span>
                    </div>
                    <p className="font-black text-xl uppercase leading-none">Flux Révélations</p>
                    <p className="font-mono text-[9px] text-white/40 mt-1">{totalDocs} signal{totalDocs !== 1 ? 's' : ''} actif{totalDocs !== 1 ? 's' : ''}</p>
                </div>

                {/* Filtre géographique */}
                <div className="border-2 border-ink p-4 bg-paper-bright shadow-hard-sm">
                    <div className="font-mono font-black text-[9px] uppercase tracking-widest text-ink/40 mb-3 border-b border-ink/10 pb-2">Zone Géographique</div>
                    <div className="space-y-1">
                        {geoOptions.map(({ value, label, flag }) => (
                            <button
                                key={value}
                                onClick={() => onGeo(value)}
                                className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all border-2 ${geoFilter === value
                                    ? 'bg-ink text-paper border-ink'
                                    : 'bg-paper text-ink border-transparent hover:border-ink'
                                }`}
                            >
                                <span className="text-base leading-none">{flag}</span> {label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filtre par tags */}
                {allTags.length > 0 && (
                    <div className="border-2 border-ink p-4 bg-paper-bright shadow-hard-sm">
                        <div className="font-mono font-black text-[9px] uppercase tracking-widest text-ink/40 mb-3 border-b border-ink/10 pb-2">Thématiques</div>
                        <div className="flex flex-wrap gap-1.5">
                            {activeTag && (
                                <button
                                    onClick={() => onTag(null)}
                                    className="w-full text-[9px] font-mono text-lassez-red uppercase tracking-widest text-left mb-1 hover:underline"
                                >
                                    ✕ Effacer le filtre
                                </button>
                            )}
                            {allTags.map((t: any) => (
                                <button
                                    key={t.id}
                                    onClick={() => onTag(t.slug === activeTag ? null : t.slug)}
                                    className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-wide border-2 transition-all ${activeTag === t.slug
                                        ? 'bg-lassez-red text-white border-lassez-red'
                                        : 'bg-paper text-ink border-lassez-border hover:border-ink hover:bg-ink hover:text-paper'
                                    }`}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Légende niveaux */}
                <div className="border-2 border-ink p-4 bg-paper-bright shadow-hard-sm">
                    <div className="font-mono font-black text-[9px] uppercase tracking-widest text-ink/40 mb-3 border-b border-ink/10 pb-2">Classification</div>
                    <div className="space-y-2 text-[10px] font-mono">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-lassez-red block flex-shrink-0" />
                            <span className="font-black uppercase">Confidentiel</span>
                        </div>
                        <p className="text-ink/50 text-[9px]">Source protégée · Vérification indépendante</p>
                        <div className="flex items-center gap-2 mt-2">
                            <span className="w-3 h-3 bg-gray-200 border border-gray-400 block flex-shrink-0" />
                            <span className="font-black uppercase">Public</span>
                        </div>
                        <p className="text-ink/50 text-[9px]">Signal ouvert · En cours d'analyse</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}

// ─── Carte Révélation ─────────────────────────────────────────────────────────
function RevCard({ rev, isExpanded, onToggle, onTag, activeTag }: {
    rev: Revelation; isExpanded: boolean;
    onToggle(): void; onTag(slug: string | null): void; activeTag: string | null;
}) {
    const date         = safeDate(rev.createdAt);
    const niveau       = rev.niveau_alerte ?? 'Public';
    const html         = (rev as any).contenu_rapide_html ?? '';
    const revTags      = Array.isArray(rev.tags)
        ? rev.tags.filter((t): t is Tag => typeof t === 'object')
        : [];
    const isShort      = html.length < 400;

    return (
        <div id={String(rev.id)} className="scroll-mt-32">
            <div
                onClick={() => !isExpanded && onToggle()}
                className={`bg-white border-2 border-black shadow-hard transition-all duration-200 ${isExpanded ? 'shadow-hard-xl' : 'hover:shadow-hard-md hover:-translate-y-0.5 cursor-pointer'}`}
            >
                {/* Top bar */}
                <div className="flex items-stretch border-b-2 border-black">
                    {/* Level indicator */}
                    <div className={`w-2 flex-shrink-0 ${niveau === 'Confidentiel' ? 'bg-lassez-red' : 'bg-gray-200'}`} />

                    <div className="flex-1 flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-3">
                            {date && (
                                <span className="font-mono text-[10px] font-black bg-ink text-paper px-2 py-0.5">
                                    {format(date, 'dd.MM HH:mm', { locale: fr })}
                                </span>
                            )}
                            {rev.zone_geo && (
                                <span className="font-mono text-[9px] text-ink/50 uppercase">
                                    {rev.zone_geo === 'france' ? '🇫🇷 France' : '🌐 Intl'}
                                </span>
                            )}
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 border ${niveau === 'Confidentiel' ? 'bg-lassez-red text-white border-lassez-red' : 'bg-gray-100 text-gray-600 border-gray-300'}`}>
                            {niveau}
                        </span>
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 md:p-5">
                    <h3 className="font-black text-base md:text-lg uppercase leading-tight mb-3">
                        {rev.titre}
                    </h3>

                    {/* Tags */}
                    {revTags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                            {revTags.map(t => (
                                <button
                                    key={t.id}
                                    onClick={e => { e.stopPropagation(); onTag(t.slug === activeTag ? null : t.slug); }}
                                    className={`px-2 py-0.5 text-[9px] font-black uppercase border-2 transition-all ${activeTag === t.slug
                                        ? 'bg-black text-white border-black'
                                        : 'bg-white text-gray-500 border-black/20 hover:border-lassez-red hover:text-lassez-red'
                                    }`}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Contenu */}
                    {isShort ? (
                        <div className="font-serif text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: html }} />
                    ) : (
                        <>
                            {!isExpanded && (
                                <p className="font-serif text-sm text-gray-600 italic line-clamp-2">
                                    {stripHtml(html).substring(0, 200)}…
                                </p>
                            )}
                            <div className={`overflow-hidden transition-[max-height] duration-500 ease-in-out ${isExpanded ? 'max-h-[3000px]' : 'max-h-0'}`}>
                                <div className="font-serif text-sm text-gray-800 leading-relaxed prose prose-sm max-w-none pt-3 border-t-2 border-black/10 mt-3"
                                    dangerouslySetInnerHTML={{ __html: html }} />
                                <div className="mt-4 pt-3 border-t border-black/10 flex items-center gap-2 text-[9px] font-mono text-gray-400 uppercase">
                                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                                    Authenticité confirmée par la rédaction.
                                </div>
                            </div>

                            <button
                                onClick={e => { e.stopPropagation(); onToggle(); }}
                                className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:text-lassez-red transition-colors"
                            >
                                {isExpanded ? 'Réduire' : 'Lire le message complet'}
                                <ChevronUpIcon className={`w-3 h-3 transition-transform ${isExpanded ? '' : 'rotate-180'}`} />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Page principale ──────────────────────────────────────────────────────────
const RevelationsClient: React.FC = () => {
    const searchParams = useSearchParams();
    const router       = useRouter();

    const geoFilter  = (searchParams?.get('geo') as GeoFilter) ?? 'all';
    const activeTag  = searchParams?.get('tag') ?? null;

    const [page, setPage]            = useState(1);
    const [revelations, setRevs]     = useState<Revelation[]>([]);
    const [totalDocs, setTotalDocs]  = useState(0);
    const [hasMore, setHasMore]      = useState(false);
    const [isLoading, setLoading]    = useState(true);
    const [error, setError]          = useState(false);
    const [expanded, setExpanded]    = useState<(string | number)[]>([]);
    const [allTags, setAllTags]      = useState<Tag[]>([]);
    const prevKey                    = useRef('');

    // Tags depuis l'API
    useEffect(() => {
        fetch('/api/tags?per_page=50&orderby=name&order=asc')
            .then(r => r.json())
            .then(d => setAllTags(Array.isArray(d) ? d : (d?.docs ?? [])))
            .catch(() => setAllTags([]));
    }, []);

    // Données révélations
    useEffect(() => {
        const key = `${geoFilter}|${activeTag}|${page}`;
        const filtersChanged = prevKey.current.split('|').slice(0, 2).join('|') !== [geoFilter, activeTag].join('|');
        if (filtersChanged) { setRevs([]); setPage(1); prevKey.current = key; }

        let cancelled = false;
        setLoading(true);
        setError(false);

        const params = new URLSearchParams({ per_page: '15', page: String(filtersChanged ? 1 : page) });
        if (geoFilter !== 'all') params.set('zone_geo', geoFilter);
        if (activeTag)           params.set('tag', activeTag);

        fetch(`/api/revelations?${params}`)
            .then(r => r.json())
            .then((data: PayloadResult) => {
                if (cancelled) return;
                const p = filtersChanged ? 1 : page;
                setRevs(prev => p === 1 ? data.docs : [...prev, ...data.docs]);
                setTotalDocs(data.totalDocs);
                setHasMore(data.hasNextPage);
                setLoading(false);
            })
            .catch(() => { if (!cancelled) { setError(true); setLoading(false); } });

        return () => { cancelled = true; };
    }, [geoFilter, activeTag, page]);

    const setGeoFilter = useCallback((geo: GeoFilter) => {
        const p = new URLSearchParams(searchParams?.toString() ?? '');
        if (geo === 'all') p.delete('geo'); else p.set('geo', geo);
        router.push(`/revelations?${p}`, { scroll: false });
    }, [searchParams, router]);

    const setTagFilter = useCallback((slug: string | null) => {
        const p = new URLSearchParams(searchParams?.toString() ?? '');
        if (!slug) p.delete('tag'); else p.set('tag', slug);
        router.push(`/revelations?${p}`, { scroll: false });
    }, [searchParams, router]);

    const toggleExpand = (id: string | number) =>
        setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <Sidebar
                    geoFilter={geoFilter}
                    activeTag={activeTag}
                    allTags={allTags}
                    totalDocs={totalDocs}
                    onGeo={setGeoFilter}
                    onTag={setTagFilter}
                />

                {/* ── Feed principal ───────────────────────────────────────── */}
                <main className="flex-1 min-w-0">
                    {/* Breadcrumb actif */}
                    {(geoFilter !== 'all' || activeTag) && (
                        <div className="flex items-center gap-2 mb-6 text-[10px] font-mono uppercase">
                            <span className="text-ink/40">Filtre actif :</span>
                            {geoFilter !== 'all' && <span className="bg-ink text-paper px-2 py-0.5 font-black">{geoFilter}</span>}
                            {activeTag && <span className="bg-lassez-red text-white px-2 py-0.5 font-black">#{activeTag}</span>}
                            <button
                                onClick={() => { setGeoFilter('all'); setTagFilter(null); }}
                                className="text-lassez-red hover:underline ml-1"
                            >
                                × Réinitialiser
                            </button>
                        </div>
                    )}

                    {/* État loading */}
                    {isLoading && revelations.length === 0 && (
                        <div className="flex justify-center py-20">
                            <div className="flex items-center gap-4 text-black/40 font-mono font-bold uppercase animate-pulse">
                                <LoaderIcon className="w-6 h-6 animate-spin" /> Connexion au flux...
                            </div>
                        </div>
                    )}

                    {/* Erreur */}
                    {error && (
                        <div className="bg-lassez-red/10 border-4 border-lassez-red p-8 text-center" role="alert">
                            <AlertTriangleIcon className="w-8 h-8 text-lassez-red mx-auto mb-2" />
                            <p className="font-black text-xl uppercase mb-1">Signal Perdu</p>
                            <p className="text-sm font-mono">Impossible de charger le flux.</p>
                        </div>
                    )}

                    {/* Aucun résultat */}
                    {!isLoading && !error && revelations.length === 0 && (
                        <div className="border-4 border-black bg-yellow-400 p-8 text-center shadow-hard">
                            <p className="font-black text-xl uppercase mb-2">Aucune Révélation</p>
                            <p className="font-bold text-sm uppercase mb-4">Aucun signal pour ces filtres.</p>
                            <button
                                onClick={() => { setGeoFilter('all'); setTagFilter(null); }}
                                className="px-4 py-2 bg-black text-white font-mono text-xs uppercase hover:bg-lassez-red transition-colors"
                            >
                                Réinitialiser
                            </button>
                        </div>
                    )}

                    {/* Timeline */}
                    {revelations.length > 0 && (
                        <div className="relative border-l-2 border-lassez-border/30 pl-6 space-y-6">
                            {revelations.map((rev, i) => (
                                <div key={rev.id} className="relative">
                                    {/* Dot timeline */}
                                    <div className={`absolute -left-[29px] top-4 w-3 h-3 rounded-full border-2 border-white z-10 transition-colors ${i === 0 ? 'bg-lassez-red animate-pulse' : 'bg-ink'}`} />

                                    <RevCard
                                        rev={rev}
                                        isExpanded={expanded.includes(rev.id)}
                                        onToggle={() => toggleExpand(rev.id)}
                                        onTag={setTagFilter}
                                        activeTag={activeTag}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Charger plus */}
                    {hasMore && !isLoading && (
                        <button
                            onClick={() => setPage(p => p + 1)}
                            className="mt-10 w-full py-3 border-2 border-black font-black uppercase text-xs hover:bg-black hover:text-white transition-all"
                        >
                            Charger l'historique
                        </button>
                    )}

                    {isLoading && revelations.length > 0 && (
                        <div className="flex justify-center mt-6">
                            <LoaderIcon className="w-5 h-5 animate-spin text-lassez-red" />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default RevelationsClient;
