import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const DecodingTemplate: StudioTemplate = {
    id: 'DECODING',
    name: 'Décodage Politique',
    category: 'Analyse',
    description: 'Une comparaison directe entre le jargon officiel et la réalité du terrain.',
    
    defaultState: {
        headline: "DÉCRYPTAGE DU DISCOURS GOUVERNEMENTAL",
        brand: "L'ASSEZ",
        accent: "#BC0100",
        jargonTerm: "SIMPLIFICATION",
        officialDef: "Optimisation des processus administratifs pour libérer les énergies productives et réduire les délais de traitement.",
        realityCheck: "Suppression massive de services publics de proximité et transfert de la charge de travail vers les usagers via la dématérialisation forcée.",
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Réalité', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre de Section', type: 'text', group: 'Contenu' },
        { key: 'jargonTerm', label: 'Terme à décoder', type: 'text', group: 'Contenu' },
        { key: 'officialDef', label: 'Version Officielle', type: 'text', group: 'Contenu' },
        { key: 'realityCheck', label: 'La Réalité', type: 'text', group: 'Contenu' },
    ],
    
    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full bg-white overflow-hidden border-4 border-black flex flex-col relative">
                
                
                <div className="bg-black px-7 pt-6 pb-4 shrink-0 border-b-4 border-black">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div className="w-2 h-0.5 bg-black"></div></div>
                        <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{state.brand}</span>
                        <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: '#fff' }}>LE MÉCANICIEN</div>
                    </div>
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                        className="ab block text-white uppercase leading-tight" style={{ fontSize: '1.5rem' }} />
                </div>

                <div className="bg-white px-7 py-6 border-b-4 border-black shrink-0 flex items-center gap-5">
                    <div className="relative">
                        <span className="ab font-black uppercase text-black" style={{ fontSize: 'clamp(2.5rem,10vw,4rem)', lineHeight: 1, letterSpacing: '-0.04em' }}>
                            {state.jargonTerm}
                        </span>
                        <div className="absolute top-1/2 left-0 right-0 h-1.5 -translate-y-1/2 pointer-events-none" style={{ backgroundColor: state.accent, transform: 'translateY(-50%) rotate(-2deg)' }}></div>
                    </div>
                    <div className="ml-auto shrink-0 w-12 h-12 flex items-center justify-center border-4 border-black">
                        <span className="ab font-black text-2xl" style={{ color: state.accent }}>✕</span>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="w-1/2 border-r-4 border-black p-6 flex flex-col bg-white">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-black flex items-center justify-center shrink-0">
                                <span className="text-white sm font-bold" style={{ fontSize: '0.55rem' }}>OFF</span>
                            </div>
                            <span className="sm font-black uppercase text-black" style={{ fontSize: '0.62rem', letterSpacing: '0.15em' }}>VERSION OFFICIELLE</span>
                        </div>
                        <div className="flex-1 border-l-4 pl-4 py-2" style={{ borderColor: '#888' }}>
                            <EditZone html={state.officialDef} onChange={h => patch({ officialDef: h })} label="VERSION OFF." stickerPos="-top-5 right-0"
                                className="ir text-black leading-relaxed italic" style={{ fontSize: '0.9rem' }} />
                        </div>
                    </div>
                    <div className="w-1/2 p-6 flex flex-col" style={{ backgroundColor: state.accent }}>
                        <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 bg-black flex items-center justify-center shrink-0">
                                <span className="text-white sm font-bold" style={{ fontSize: '0.55rem' }}>▲</span>
                            </div>
                            <span className="sm font-black uppercase text-black" style={{ fontSize: '0.62rem', letterSpacing: '0.15em' }}>LA RÉALITÉ</span>
                        </div>
                        <div className="flex-1 border-l-4 border-black pl-4 py-2">
                            <EditZone html={state.realityCheck} onChange={h => patch({ realityCheck: h })} label="RÉALITÉ" stickerPos="-top-5 right-0"
                                className="sm font-bold text-black leading-relaxed" style={{ fontSize: '0.88rem' }} />
                        </div>
                    </div>
                </div>

                <div className="bg-black px-6 py-3 border-t-4 border-black shrink-0 flex items-center justify-between">
                    <span className="ab font-black text-white uppercase" style={{ fontSize: '0.65rem' }}>{state.brand} / DÉCODAGE POLITIQUE</span>
                </div>
            </div>
        );
    }
};
