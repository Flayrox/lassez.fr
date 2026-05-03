import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const ComparisonChartTemplate: StudioTemplate = {
    id: 'COMPARISON_CHART',
    name: 'Graphique de Comparaison',
    category: 'Données',
    description: 'Un graphique en barres verticales pour comparer des données quantitatives.',

    defaultState: {
        headline: "INFRACTIONS & CANDIDATS",
        subheadline: "COMPARATIF BRUTAL : PARTIS & PROPOS SIGNALÉS",
        category: "L'ASSEZ INVESTIGATION",
        bars: [
            { label: "AUTRES PARTIS*", value: 0, color: "#888" },
            { label: "DIVERS DROITE", value: 1, color: "#555" },
            { label: "DIVERS GAUCHE", value: 4, color: "#333" },
            { label: "RASSEMBLEMENT NATIONAL", value: 139, color: "#BC0100" },
        ],
        source: "Source : Analyse brute L'Assez & Bon Pote (Villes Futures), Mediapart, Libé.",
        brand: "L'ASSEZ",
        accent: "#BC0100",
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'category', label: 'Étiquette Catégorie', type: 'text', group: 'Meta' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'subheadline', label: 'Sous-titre', type: 'text', group: 'Contenu' },
        { key: 'source', label: 'Source des données', type: 'text', group: 'Contenu' },
        {
            key: 'bars', label: 'Barres du graphique', type: 'list', group: 'Données',
            itemSchema: [
                { key: 'label', label: 'Nom', type: 'text' },
                { key: 'value', label: 'Valeur', type: 'number', props: { min: 0, max: 1000 } },
                { key: 'color', label: 'Couleur', type: 'color' },
            ]
        }
    ],

    Component: ({ state, patch }) => {
        const bars = state.bars || [];
        const maxVal = Math.max(...bars.map((b: any) => b.value), 1);

        const updateBarValue = (i: number, val: string) => {
            const newBars = [...bars];
            const numVal = parseInt(val.replace(/[^0-9]/g, '')) || 0;
            newBars[i] = { ...newBars[i], value: numVal };
            patch({ bars: newBars });
        };

        const updateBarLabel = (i: number, text: string) => {
            const newBars = [...bars];
            newBars[i] = { ...newBars[i], label: text };
            patch({ bars: newBars });
        };

        const addBar = () => {
            patch({ bars: [...bars, { label: "NOUVEAU", value: 10, color: state.accent }] });
        };

        const removeBar = (i: number) => {
            patch({ bars: bars.filter((_: any, index: number) => index !== i) });
        };

        const moveBar = (i: number, dir: number) => {
            const newBars = [...bars];
            const target = i + dir;
            if (target < 0 || target >= bars.length) return;
            [newBars[i], newBars[target]] = [newBars[target], newBars[i]];
            patch({ bars: newBars });
        };

        return (
            <div className="w-full h-full bg-[#F4F4F4] overflow-hidden border-4 border-black flex flex-col relative">


                <div className="bg-black text-white px-6 pt-5 pb-4 border-b-4 border-black shrink-0 z-10">
                    <div className="inline-block px-3 py-0.5 sm text-[10px] font-bold uppercase tracking-widest mb-2 border border-white/30" style={{ background: state.accent }}>
                        <EditZone html={state.category} onChange={h => patch({ category: h })} label="CAT" stickerPos="top-0 right-0" className="sm text-[10px] font-bold uppercase text-white" />
                    </div>
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                        className="ab block text-white uppercase leading-[0.92] tracking-tight mb-1" style={{ fontSize: 'clamp(1.5rem, 6vw, 2.2rem)' }} />
                    <EditZone html={state.subheadline} onChange={h => patch({ subheadline: h })} label="SOUS-TITRE" stickerPos="-top-5 left-0"
                        className="sm block text-white/70 uppercase font-bold tracking-wide" style={{ fontSize: '0.65rem' }} />
                </div>

                <div className="flex-1 px-8 pt-5 pb-0 flex flex-col">
                    <div className="relative flex-1 border-l-4 border-b-4 border-black group/chart">
                        {[25, 50, 75, 100].map(pct => (
                            <div key={pct} className="absolute w-full border-t border-black/10" style={{ bottom: `${pct}%` }}>
                                <span className="sm absolute right-[calc(100%+4px)] text-[8px] text-gray-400 bottom-0 leading-none">{Math.round(maxVal * pct / 100)}</span>
                            </div>
                        ))}
                        <div className="absolute inset-0 flex items-end justify-around gap-3 px-3">
                            {bars.map((bar: any, i: number) => {
                                const pct = maxVal === 0 ? 2 : Math.max((bar.value / maxVal) * 100, 2);
                                const isSmall = pct < 20;
                                const isMax = bar.value === Math.max(...bars.map((b: any) => b.value));
                                return (
                                    <div key={i} className="flex flex-col items-center justify-end flex-1 h-full relative group/bar">
                                        <div 
                                            className="absolute -top-6 opacity-0 group-hover/bar:opacity-100 transition-opacity z-50 flex gap-1"
                                        >
                                            <button onClick={() => moveBar(i, -1)} className="bg-white border border-black w-4 h-4 flex items-center justify-center text-[8px] text-black hover:bg-gray-50">←</button>
                                            <button onClick={() => moveBar(i, 1)} className="bg-white border border-black w-4 h-4 flex items-center justify-center text-[8px] text-black hover:bg-gray-50">→</button>
                                            <button onClick={() => removeBar(i)} className="bg-white border border-black w-4 h-4 flex items-center justify-center text-[8px] text-black hover:bg-red-50">✕</button>
                                        </div>

                                        <EditZone 
                                            html={bar.value.toString()} 
                                            onChange={h => updateBarValue(i, h)} 
                                            label="VAL" 
                                            stickerPos="-top-4"
                                            className="ab font-black text-black text-center whitespace-nowrap" 
                                            style={{ 
                                                fontSize: isSmall ? '1.2rem' : (pct > 35 ? '1.8rem' : '0.9rem'), 
                                                lineHeight: 1, 
                                                color: isSmall ? 'black' : 'white', 
                                                position: 'absolute', 
                                                top: isSmall ? -(isSmall ? 25 : 30) : 10, 
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                zIndex: 20 
                                            }} 
                                        />

                                        <div className="w-full relative flex items-start justify-center pt-1 border-2 border-black"
                                            style={{ height: `${pct}%`, backgroundColor: bar.color, boxShadow: isMax ? `3px -3px 0 ${state.accent}` : 'none', minHeight: '6px' }}>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <button onClick={addBar} className="absolute -right-12 top-1/2 -translate-y-1/2 rotate-90 bg-black text-white text-[9px] font-bold px-2 py-1 uppercase tracking-widest opacity-0 group-hover/chart:opacity-100 transition-opacity">
                            + Bar
                        </button>
                    </div>
                    <div className="flex justify-around gap-3 pt-2 pb-4">
                        {bars.map((bar: any, i: number) => (
                            <div key={i} className="flex-1 text-center px-1">
                                <div className="w-full h-1 mb-1.5" style={{ backgroundColor: bar.color }}></div>
                                <EditZone 
                                    html={bar.label} 
                                    onChange={h => updateBarLabel(i, h)} 
                                    label="LABEL" 
                                    stickerPos="bottom-0"
                                    className="sm block font-black uppercase leading-[1.1] text-black" 
                                    style={{ fontSize: '0.62rem', wordBreak: 'break-word', hyphens: 'auto' }} 
                                />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-black text-white px-5 py-3 border-t-4 border-black shrink-0 z-10 flex justify-between items-center">
                    <EditZone html={state.source} onChange={h => patch({ source: h })} label="SOURCE" stickerPos="top-0 right-0"
                        className="sm text-white/70 leading-tight" style={{ fontSize: '0.62rem' }} />
                    <div className="shrink-0 ml-3 px-2 py-1 border-2 border-white">
                        <EditZone html={state.brand} onChange={h => patch({ brand: h })} label="MARQUE" stickerPos="top-0 right-0"
                            className="ab font-bold text-white text-xs uppercase" />
                    </div>
                </div>
            </div>
        );
    }
};
