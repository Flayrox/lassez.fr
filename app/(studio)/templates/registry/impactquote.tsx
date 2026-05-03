import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const ImpactQuoteTemplate: StudioTemplate = {
    id: 'IMPACT_QUOTE',
    name: 'Citation d\'Impact',
    category: 'Analyse',
    description: 'Une citation mise en valeur sur fond sombre pour un impact maximum.',

    defaultState: {
        largeQuote: "NOUS NE POUVONS PAS RESTER SPECTATEURS DE NOTRE PROPRE DÉPOSSESSION.",
        author: "ANONYME",
        context: "MANIFESTE POUR LA DIGNITÉ - 2024",
        brand: "L'ASSEZ",
        accent: "#BC0100",
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'largeQuote', label: 'La Citation', type: 'text', group: 'Contenu' },
        { key: 'author', label: 'Auteur', type: 'text', group: 'Contenu' },
        { key: 'context', label: 'Contexte / Source', type: 'text', group: 'Contenu' },
    ],

    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full bg-[#111] overflow-hidden border-4 border-black flex flex-col relative">


                <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b-2 shrink-0 z-10" style={{ borderColor: state.accent + '50' }}>
                    <div className="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div className="w-2 h-0.5 bg-black"></div></div>
                    <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{state.brand}</span>
                    <div className="ml-auto w-5 h-5 border-2 flex items-center justify-center" style={{ borderColor: state.accent }}>
                        <span className="sm font-black" style={{ fontSize: '0.5rem', color: state.accent }}>"</span>
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center px-7 py-4 z-10">
                    <div className="self-start ab font-black leading-none mb-2" style={{ fontSize: '5rem', lineHeight: 0.6, color: state.accent, opacity: 0.8 }}>"</div>
                    <EditZone html={state.largeQuote} onChange={h => patch({ largeQuote: h })} label="CITATION" stickerPos="-top-5 right-0"
                        className="ir font-bold text-white leading-tight text-center" style={{ fontSize: 'clamp(1.2rem, 4.5vw, 2rem)' }} />
                    <div className="self-end ab font-black leading-none mt-2" style={{ fontSize: '5rem', lineHeight: 0.6, color: state.accent, opacity: 0.8 }}>"</div>
                </div>

                <div className="border-t-4 px-7 py-5 shrink-0 z-10" style={{ backgroundColor: state.accent, borderColor: '#000' }}>
                    <span className="ab font-black text-black uppercase block leading-tight" style={{ fontSize: '1.1rem' }}>— {state.author}</span>
                    <span className="sm font-bold text-black/70 uppercase mt-1 block" style={{ fontSize: '0.6rem' }}>{state.context}</span>
                </div>
            </div>
        );
    }
};
