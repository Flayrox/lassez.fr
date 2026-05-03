import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const StackedDataTemplate: StudioTemplate = {
    id: 'STACKED_DATA',
    name: 'Données Empilées',
    category: 'Données',
    description: 'Un graphique complexe montrant la distribution de données par catégories et sous-catégories.',

    defaultState: {
        headline: "L'INFOGRAPHIE BRUTE DES DISCRIMINATIONS SYSTÉMIQUES",
        subheadline: "ANALYSE DES INCIDENTS SIGNALÉS ET DES RÉPONSES INSTITUTIONNELLES (2023-2024)",
        columns: [
            { label: "RACISME", color: "#BC0100" },
            { label: "ANTISÉMITISME", color: "#7A0000" },
            { label: "SEXISME / HOMOPHOBIE", color: "#1A1A1A" },
            { label: "VIOLENCES / HARCÈLEMENT", color: "#555" },
            { label: "DISCRIMINATION", color: "#999" },
        ],
        rows: [
            { sector: "SECTEUR PUBLIC", cells: [{ value: 512, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
            { sector: "ENTREPRISES PRIVÉES", cells: [{ value: 408, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
            { sector: "ÉDUCATION", cells: [{ value: 366, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 276, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "VIOLENCES / HARCÈLEMENT" }, { value: 79, label: "DISCRIMINATION" }] },
            { sector: "LOGEMENT SOCIAL", cells: [{ value: 446, label: "RACISME" }, { value: 114, label: "ANTISÉMITISME" }, { value: 298, label: "SEXISME / HOMOPHOBIE" }, { value: 176, label: "HARCÈLEMENT" }, { value: 82, label: "DISCRIMINATION" }] },
        ],
        source: "SOURCE: L'ASSEZ ENQUÊTES & DONNÉES BRUTES. TOUS DROITS RÉSERVÉS. ÉDITION 2024.",
        brand: "L'ASSEZ",
        accent: "#BC0100",
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'subheadline', label: 'Sous-titre', type: 'text', group: 'Contenu' },
        { key: 'source', label: 'Source', type: 'text', group: 'Contenu' },
    ],

    Component: ({ state, patch }) => {
        const rows = state.rows || [];
        const columns = state.columns || [];

        return (
            <div className="w-full h-full bg-[#F9F9F9] overflow-hidden border-4 border-black flex flex-col relative">


                <div className="bg-black text-white px-5 pt-5 pb-3 shrink-0 z-10">
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                        className="ab block text-white font-black uppercase leading-tight tracking-tight" style={{ fontSize: 'clamp(0.95rem, 4vw, 1.4rem)' }} />
                </div>

                <div className="bg-[#F9F9F9] px-5 py-2 border-b-4 border-black shrink-0 z-10">
                    <EditZone html={state.subheadline} onChange={h => patch({ subheadline: h })} label="SOUS-TITRE" stickerPos="top-0 right-0"
                        className="sm block font-bold uppercase" style={{ fontSize: '0.57rem', color: '#1A1C1C' }} />
                </div>

                <div className="flex-1 overflow-hidden flex flex-col px-4 py-3 gap-2">
                    {rows.map((row: any, ri: number) => {
                        const rowTotal = Math.max(row.cells.reduce((s: number, c: any) => s + c.value, 0), 1);
                        return (
                            <div key={ri} className="flex flex-col flex-1 min-h-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="sm font-black uppercase text-black" style={{ fontSize: '0.58rem', letterSpacing: '0.1em' }}>{row.sector}</span>
                                    <div className="flex-1 h-[2px] bg-black/15"></div>
                                    <span className="sm font-bold text-black/50" style={{ fontSize: '0.55rem' }}>{rowTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex h-full border-2 border-black overflow-hidden">
                                    {row.cells.map((cell: any, ci: number) => {
                                        const col = columns[ci];
                                        const widthPct = (cell.value / rowTotal) * 100;
                                        if (widthPct < 0.3) return null;
                                        return (
                                            <div key={ci}
                                                className="relative flex flex-col items-center justify-center overflow-hidden border-r border-black/20 last:border-r-0 transition-all"
                                                style={{ width: `${widthPct}%`, backgroundColor: col?.color ?? '#888', minWidth: widthPct > 4 ? undefined : 0 }}>
                                                {widthPct > 9 && (
                                                    <>
                                                        <span className="ab font-black text-white leading-none" style={{ fontSize: widthPct > 20 ? '1.1rem' : '0.7rem', textShadow: '1px 1px 0 rgba(0,0,0,0.4)' }}>{cell.value}</span>
                                                        {widthPct > 18 && <span className="sm text-white/70 uppercase leading-none" style={{ fontSize: '0.42rem' }}>{cell.label || col?.label}</span>}
                                                    </>
                                                )}
                                                {widthPct <= 9 && widthPct > 4 && (
                                                    <span className="ab font-black text-white" style={{ fontSize: '0.55rem', writingMode: 'vertical-rl', textShadow: '1px 1px 0 rgba(0,0,0,0.5)' }}>{cell.value}</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="border-t-4 border-black px-5 py-2 bg-[#F9F9F9] flex gap-3 flex-wrap shrink-0 z-10">
                    {columns.map((col: any, ci: number) => (
                        <div key={ci} className="flex items-center gap-1">
                            <div className="w-3 h-3 border border-black" style={{ backgroundColor: col.color }}></div>
                            <span className="sm uppercase font-bold" style={{ fontSize: '0.48rem', color: '#1A1C1C' }}>{col.label}</span>
                        </div>
                    ))}
                </div>

                <div className="bg-black text-white flex items-center justify-between px-5 py-2 shrink-0 z-10">
                    <EditZone html={state.source} onChange={h => patch({ source: h })} label="SOURCE" stickerPos="top-0 right-0"
                        className="sm text-white/70 uppercase flex-1" style={{ fontSize: '0.5rem' }} />
                    <div className="ml-3 px-2 py-0.5 border-2 border-white shrink-0">
                        <span className="ab font-bold text-white text-xs uppercase">{state.brand}</span>
                    </div>
                </div>
            </div>
        );
    }
};
