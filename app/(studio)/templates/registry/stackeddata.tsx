import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';

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
            { sector: "SECTEUR PUBLIC", "0": 512, "1": 114, "2": 298, "3": 176, "4": 82 },
            { sector: "ENTREPRISES PRIVÉES", "0": 408, "1": 114, "2": 298, "3": 176, "4": 82 },
            { sector: "ÉDUCATION", "0": 366, "1": 114, "2": 276, "3": 176, "4": 79 },
            { sector: "LOGEMENT SOCIAL", "0": 446, "1": 114, "2": 298, "3": 176, "4": 82 },
        ],
        source: "SOURCE: L'ASSEZ ENQUÊTES & DONNÉES BRUTES. TOUS DROITS RÉSERVÉS. ÉDITION 2024.",
        brand: "L'ASSEZ",
        accent: "#BC0100",
    },

    schema: (state: any) => [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'subheadline', label: 'Sous-titre', type: 'text', group: 'Contenu' },
        { key: 'source', label: 'Source', type: 'text', group: 'Contenu' },
        {
            key: 'columns', label: 'Légendes / Couleurs (LINK)', type: 'list', group: 'Données',
            itemSchema: [
                { key: 'label', label: 'Nom de catégorie', type: 'text' },
                { key: 'color', label: 'Couleur', type: 'color' },
            ]
        },
        {
            key: 'rows', label: 'Secteurs & Valeurs', type: 'list', group: 'Données',
            props: { variant: 'compact' },
            itemSchema: [
                { key: 'sector', label: 'NOM DU SECTEUR', type: 'text' },
                ...(state.columns || []).map((col: any, ci: number) => ({
                    key: ci.toString(),
                    label: col.label,
                    type: 'number',
                    props: { hideSlider: true, color: col.color }
                }))
            ]
        }
    ],

    Component: ({ state, patch }) => {
        const rows = state.rows || [];
        const columns = state.columns || [];

        const updateCellValue = (ri: number, ci: number, val: string) => {
            const newRows = [...rows];
            const numVal = parseInt(val.replace(/[^0-9]/g, '')) || 0;
            newRows[ri] = { ...newRows[ri], [ci]: numVal };
            patch({ rows: newRows });
        };

        const addRow = () => {
            const newRow: any = { sector: "NOUVEAU" };
            columns.forEach((_: any, i: number) => newRow[i.toString()] = 100);
            patch({ rows: [...rows, newRow] });
        };

        const removeRow = (ri: number) => {
            patch({ rows: rows.filter((_: any, i: number) => i !== ri) });
        };

        const moveRow = (ri: number, dir: number) => {
            const newRows = [...rows];
            const target = ri + dir;
            if (target < 0 || target >= rows.length) return;
            [newRows[ri], newRows[target]] = [newRows[target], newRows[ri]];
            patch({ rows: newRows });
        };

        return (
            <div className="w-full h-full bg-white overflow-hidden border-2 border-black flex flex-col relative ir">
                {/* Header Compact */}
                <div className="bg-black text-white px-4 py-3 shrink-0 flex justify-between items-end border-b-2 border-black">
                    <div className="flex-1">
                        <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="top-0 left-0"
                            className="ab block text-white font-black uppercase leading-none tracking-tighter" style={{ fontSize: '1.2rem' }} />
                        <EditZone html={state.subheadline} onChange={h => patch({ subheadline: h })} label="SOUS-TITRE" stickerPos="bottom-0 left-0"
                            className="sm block font-bold uppercase opacity-60 mt-1" style={{ fontSize: '0.5rem' }} />
                    </div>
                    <div className="px-2 py-0.5 border border-white/30 shrink-0 mb-0.5">
                        <EditZone html={state.brand} onChange={h => patch({ brand: h })} label="MARQUE" stickerPos="top-0 right-0"
                            className="ab font-bold text-white text-[10px] uppercase" />
                    </div>
                </div>

                {/* Data Area - Compact Rows */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 sb group/container">
                    {rows.map((row: any, ri: number) => {
                        const rowTotal = Math.max(columns.reduce((s: number, _: any, ci: number) => s + (parseFloat(row[ci]) || 0), 0), 1);
                        return (
                            <div key={ri} className="flex flex-col flex-1 min-h-[40px] relative group/row">
                                <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <div className="flex gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                            <button onClick={() => moveRow(ri, -1)} className="w-3 h-3 border border-black/10 flex items-center justify-center text-[6px] hover:bg-black hover:text-white">▲</button>
                                            <button onClick={() => moveRow(ri, 1)} className="w-3 h-3 border border-black/10 flex items-center justify-center text-[6px] hover:bg-black hover:text-white">▼</button>
                                        </div>
                                        <EditZone 
                                            html={row.sector} 
                                            onChange={h => {
                                                const newRows = [...rows];
                                                newRows[ri] = { ...newRows[ri], sector: h };
                                                patch({ rows: newRows });
                                            }} 
                                            label="NOM" 
                                            stickerPos="top-0"
                                            className="sm font-black uppercase text-black" 
                                            style={{ fontSize: '0.6rem' }} 
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="sm font-bold text-black/40" style={{ fontSize: '0.55rem' }}>{rowTotal.toLocaleString()} units</span>
                                        <button onClick={() => removeRow(ri)} className="opacity-0 group-hover/row:opacity-100 transition-opacity w-4 h-4 border border-black flex items-center justify-center text-[8px] hover:bg-red-600 hover:text-white hover:border-red-600">✕</button>
                                    </div>
                                </div>
                                
                                <div className="flex-1 flex border-[1.5px] border-black overflow-hidden shadow-[2px_2px_0_rgba(0,0,0,1)]">
                                    {columns.map((col: any, ci: number) => {
                                        const val = parseFloat(row[ci]) || 0;
                                        const widthPct = (val / rowTotal) * 100;
                                        if (widthPct < 0.1) return null;
                                        return (
                                            <div key={ci}
                                                className="relative h-full flex items-center justify-center border-r border-black/20 last:border-r-0 group/cell"
                                                style={{ width: `${widthPct}%`, backgroundColor: col?.color ?? '#888' }}>
                                                <EditZone 
                                                    html={val.toString()} 
                                                    onChange={h => updateCellValue(ri, ci, h)} 
                                                    label="VAL" 
                                                    stickerPos="top-0"
                                                    className="ab font-black text-white leading-none" 
                                                    style={{ fontSize: widthPct > 15 ? '0.85rem' : '0.6rem' }} 
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}

                    <button onClick={addRow} className="h-6 border border-dashed border-black/20 flex items-center justify-center opacity-0 group-hover/container:opacity-40 hover:group-hover/container:opacity-100 transition-all sm text-[8px] font-bold uppercase tracking-widest mt-2">
                        + AJOUTER SECTEUR
                    </button>
                </div>

                {/* Legend Grid - Carré */}
                <div className="border-t-2 border-black bg-gray-50 p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 shrink-0">
                    {columns.map((col: any, ci: number) => (
                        <div key={ci} className="flex items-center gap-2 bg-white border border-black/10 p-1.5">
                            <div className="w-2.5 h-2.5 shrink-0" style={{ backgroundColor: col.color }}></div>
                            <EditZone 
                                html={col.label} 
                                onChange={h => {
                                    const newCols = [...columns];
                                    newCols[ci] = { ...newCols[ci], label: h };
                                    patch({ columns: newCols });
                                }} 
                                label="LÉGENDE" 
                                stickerPos="top-0"
                                className="sm uppercase font-bold truncate flex-1" 
                                style={{ fontSize: '0.52rem', color: '#000' }} 
                            />
                        </div>
                    ))}
                </div>

                {/* Footer Minimal */}
                <div className="bg-black text-white px-4 py-2 flex items-center justify-between border-t-2 border-black shrink-0">
                    <EditZone html={state.source} onChange={h => patch({ source: h })} label="SOURCE" stickerPos="top-0 left-0"
                        className="sm text-white/50 uppercase truncate mr-4" style={{ fontSize: '0.45rem' }} />
                </div>
            </div>
        );
    }
};
