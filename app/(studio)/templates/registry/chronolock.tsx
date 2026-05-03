import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const ChronoLockTemplate: StudioTemplate = {
    id: 'CHRONO_LOCK',
    name: 'Chronologie Verrouillée',
    category: 'Analyse',
    description: 'Une ligne du temps verticale pour retracer des événements clés.',

    defaultState: {
        headline: "L'ENGRENAGE DES DÉCISIONS",
        subheadline: "CHRONOLOGIE D'UN EFFONDREMENT PROGRAMMÉ",
        brand: "L'ASSEZ",
        accent: "#BC0100",
        timeline: [
            { date: "MARS 2023", event: "ADOPTION DU 49.3", impact: "Verrouillage institutionnel immédiat" },
            { date: "AVRIL 2023", event: "PROMULGATION ÉCLAIR", impact: "Contestation sociale à son paroxysme" },
            { date: "MAI 2023", event: "DÉCRETS D'APPLICATION", impact: "Entrée en vigueur forcée des mesures" },
        ],
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'subheadline', label: 'Sous-titre', type: 'text', group: 'Contenu' },
        {
            key: 'timeline', label: 'Événements', type: 'list', group: 'Données',
            itemSchema: [
                { key: 'date', label: 'Date', type: 'text' },
                { key: 'event', label: 'Événement', type: 'text' },
                { key: 'impact', label: 'Impact / Détail', type: 'text' },
            ]
        }
    ],

    Component: ({ state, patch }) => {
        const timeline = state.timeline || [];

        return (
            <div className="w-full h-full bg-[#0F0F0F] overflow-hidden border-4 border-black flex flex-col relative">


                <div className="bg-black px-7 pt-6 pb-5 shrink-0 border-b-4 border-black">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div className="w-2 h-0.5 bg-black"></div></div>
                        <EditZone 
                            html={state.brand} 
                            onChange={h => patch({ brand: h })} 
                            label="MARQUE" 
                            stickerPos="top-6 left-0"
                            className="ab font-bold uppercase tracking-widest text-white" 
                            style={{ fontSize: '0.6rem' }} 
                        />
                        <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: state.accent }}>⏱ CHRONOLOGIE</div>
                    </div>
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                        className="ab block text-white uppercase leading-[0.9]" style={{ fontSize: 'clamp(1.4rem, 5vw, 2rem)' }} />
                    <EditZone html={state.subheadline} onChange={h => patch({ subheadline: h })} label="SOUS-TITRE" stickerPos="-top-4 left-0"
                        className="sm block text-white/60 uppercase font-bold mt-1" style={{ fontSize: '0.6rem' }} />
                </div>

                <div className="flex-1 px-8 py-6 overflow-y-auto flex flex-col gap-4 sb">
                    {timeline.map((ev: any, i: number) => (
                        <div key={i} className="flex gap-5 relative group/event">
                            <div className="flex flex-col items-center shrink-0 w-6">
                                <div className="w-4 h-4 border-4 border-black bg-white shrink-0 z-10" style={{ borderColor: i === 0 ? state.accent : '#000' }}></div>
                                {i < timeline.length - 1 && (
                                    <div className="flex-1 w-[3px] bg-black mt-0.5" style={{ minHeight: '32px' }}></div>
                                )}
                            </div>
                            <div className="flex-1 pb-2">
                                <div className="flex justify-between items-start">
                                    <EditZone 
                                        html={ev.date} 
                                        onChange={h => {
                                            const newTimeline = [...timeline];
                                            newTimeline[i] = { ...newTimeline[i], date: h };
                                            patch({ timeline: newTimeline });
                                        }} 
                                        label="DATE" 
                                        stickerPos="-top-4 left-0"
                                        className="inline-block px-2 py-0.5 sm font-black uppercase text-white mb-1.5" 
                                        style={{ backgroundColor: i === 0 ? state.accent : '#1A1C1C', fontSize: '0.6rem', letterSpacing: '0.12em' }} 
                                    />
                                    <button onClick={() => {
                                        patch({ timeline: timeline.filter((_: any, idx: number) => idx !== i) });
                                    }} className="opacity-0 group-hover/event:opacity-100 transition-opacity bg-white border border-black w-4 h-4 flex items-center justify-center text-[8px] text-black">✕</button>
                                </div>
                                <EditZone 
                                    html={ev.event} 
                                    onChange={h => {
                                        const newTimeline = [...timeline];
                                        newTimeline[i] = { ...newTimeline[i], event: h };
                                        patch({ timeline: newTimeline });
                                    }} 
                                    label="EVENEMENT" 
                                    stickerPos="-top-4 right-0"
                                    className="ab font-black uppercase text-white leading-tight mb-1" 
                                    style={{ fontSize: '1rem' }} 
                                />
                                <EditZone 
                                    html={ev.impact} 
                                    onChange={h => {
                                        const newTimeline = [...timeline];
                                        newTimeline[i] = { ...newTimeline[i], impact: h };
                                        patch({ timeline: newTimeline });
                                    }} 
                                    label="IMPACT" 
                                    stickerPos="bottom-0 right-0"
                                    className="sm text-white/60 font-bold uppercase" 
                                    style={{ fontSize: '0.62rem' }} 
                                />
                            </div>
                        </div>
                    ))}

                    {timeline.length < 5 && (
                        <button onClick={() => {
                            patch({ timeline: [...timeline, { date: "NOUVELLE DATE", event: "NOUVEL ÉVÉNEMENT", impact: "IMPACT À DÉFINIR" }] });
                        }} className="h-8 border-2 border-dashed border-white/20 flex items-center justify-center gap-2 hover:bg-white/5 transition-colors sm text-[9px] font-bold uppercase tracking-widest text-white/30">
                            + Ajouter un événement
                        </button>
                    )}
                </div>

                <div className="bg-black text-white px-6 py-3 border-t-4 border-black shrink-0 flex items-center justify-between">
                    <EditZone 
                        html={state.brand} 
                        onChange={h => patch({ brand: h })} 
                        label="MARQUE" 
                        stickerPos="-top-4 left-0"
                        className="ab font-black uppercase text-white tracking-wide" 
                        style={{ fontSize: '0.65rem' }} 
                    />
                    <span className="ab font-black uppercase text-white tracking-wide" style={{ fontSize: '0.65rem' }}> / RIEN N'EST UN HASARD</span>
                </div>
            </div>
        );
    }
};
