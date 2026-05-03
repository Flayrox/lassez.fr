import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const TerritoryRadarTemplate: StudioTemplate = {
    id: 'TERRITORY_RADAR',
    name: 'Radar de Territoire',
    category: 'Géographie',
    description: 'Une carte SVG interactive avec des zones colorées et des statistiques par zone.',
    
    defaultState: {
        headline: "DÉCOMPTE DES SIÈGES PAR ZONE",
        subheadline: "CARTOGRAPHIE DES RÉSULTATS PAR CIRCONSCRIPTION",
        brand: "L'ASSEZ",
        accent: "#BC0100",
        svgContent: "",
        legend: [
            { label: "ZONE ROUGE", color: "#BC0100" },
            { label: "ZONE NOIRE", color: "#1A1C1C" },
            { label: "ZONE GRISE", color: "#555" },
            { label: "AUTRES", color: "#888" },
        ],
        stats: [
            { label: "TOTAL SIÈGES", value: "577" },
            { label: "ZONES ROUGES", value: "142" },
            { label: "ZONES NOIRES", value: "89" },
        ],
        source: "SOURCE: MINISTÈRE DE L'INTÉRIEUR / L'ASSEZ DATA",
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'subheadline', label: 'Sous-titre', type: 'text', group: 'Contenu' },
        { key: 'svgContent', label: 'Contenu SVG (raw)', type: 'text', group: 'Données' },
        { key: 'source', label: 'Source', type: 'text', group: 'Contenu' },
    ],
    
    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full bg-[#F4F4F4] overflow-hidden border-4 border-black flex flex-col relative">
                
                
                <div className="bg-black text-white px-6 pt-5 pb-4 shrink-0 z-10 border-b-4 border-black">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div className="w-2 h-0.5 bg-black"></div></div>
                        <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{state.brand}</span>
                        <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase" style={{ background: state.accent }}>TERRITOIRE</div>
                    </div>
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                        className="ab block text-white uppercase leading-[0.9] tracking-tight" style={{ fontSize: 'clamp(1.4rem,5vw,2rem)' }} />
                    <EditZone html={state.subheadline} onChange={h => patch({ subheadline: h })} label="SOUS-TITRE" stickerPos="-top-4 left-0"
                        className="sm block text-white/60 uppercase font-bold mt-1" style={{ fontSize: '0.6rem' }} />
                </div>

                <div className="flex flex-1 gap-0 overflow-hidden">
                    <div className="flex-1 relative bg-black/5 border-r-4 border-black overflow-hidden">
                        {state.svgContent ? (
                            <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: state.svgContent }} />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                                <svg viewBox="0 0 200 280" className="w-48 h-64 opacity-80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M60 10 L80 8 L110 20 L140 15 L155 40 L165 60 L150 80 L155 100 L140 120 L145 145 L130 165 L120 190 L100 220 L85 240 L70 230 L55 210 L45 185 L30 160 L20 135 L35 110 L25 80 L40 55 L50 35 Z" fill={state.legend[2]?.color ?? '#555'} />
                                    <path d="M60 10 L80 8 L110 20 L140 15 L150 30 L120 45 L100 40 L80 50 L65 35 Z" fill={state.legend[0]?.color ?? '#BC0100'} />
                                    <path d="M100 100 L130 95 L140 120 L130 145 L110 150 L95 135 L90 115 Z" fill={state.legend[1]?.color ?? '#1A1C1C'} />
                                    <path d="M40 140 L65 135 L75 155 L70 175 L50 180 L35 165 L30 145 Z" fill={state.legend[2]?.color ?? '#555'} />
                                    <path d="M80 180 L105 175 L115 195 L105 220 L85 225 L70 210 Z" fill={state.legend[3]?.color ?? '#888'} />
                                </svg>
                                <span className="sm text-[9px] text-black/30 uppercase font-bold">Coller un SVG dans svgContent</span>
                            </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-white/90 border-t-2 border-black p-3 space-y-1.5">
                            {(state.legend || []).map((l: any, i: number) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-3 h-3 border border-black shrink-0" style={{ backgroundColor: l.color }}></div>
                                    <span className="sm font-bold uppercase" style={{ fontSize: '0.58rem' }}>{l.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="w-36 shrink-0 flex flex-col bg-black">
                        {(state.stats || []).map((s: any, i: number) => (
                            <div key={i} className="flex-1 flex flex-col items-center justify-center border-b border-white/10 p-3 text-center">
                                <span className="ab font-black text-white" style={{ fontSize: '1.6rem', lineHeight: 1 }}>{s.value}</span>
                                <span className="sm font-bold text-white/50 uppercase mt-1" style={{ fontSize: '0.52rem' }}>{s.label}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-black text-white px-5 py-2.5 border-t-4 border-black shrink-0 z-10 flex justify-between items-center">
                    <EditZone html={state.source} onChange={h => patch({ source: h })} label="SOURCE" stickerPos="top-0 right-0"
                        className="sm text-white/70 tracking-widest font-bold uppercase" style={{ fontSize: '0.52rem' }} />
                    <div className="shrink-0 ml-3 px-2 py-0.5 border-2 border-white">
                        <span className="ab font-bold text-white text-xs uppercase">{state.brand}</span>
                    </div>
                </div>
            </div>
        );
    }
};
