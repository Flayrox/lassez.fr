import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const SocialCostTemplate: StudioTemplate = {
    id: 'SOCIAL_COST',
    name: 'Coût Social (Calculette)',
    category: 'Analyse',
    description: 'Une calculette d\'impact montrant les pertes financières ou sociales.',

    defaultState: {
        headline: "LE COÛT RÉEL DE L'INACTION CLIMATIQUE",
        targetAudience: "CONTRIBUABLE FRANÇAIS",
        monthlyLoss: "840€",
        annualImpact: "10 080€",
        consequence: "Ce montant correspond à la perte de pouvoir d'achat directe liée à l'augmentation des coûts de l'énergie et des assurances climatiques.",
        note: "BASÉ SUR LES PROJECTIONS DU GIEC POUR 2030 (SCÉNARIO +2°C)",
        brand: "L'ASSEZ",
        accent: "#BC0100",
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'targetAudience', label: 'Public Ciblé', type: 'text', group: 'Contenu' },
        { key: 'monthlyLoss', label: 'Perte Mensuelle', type: 'text', group: 'Données' },
        { key: 'annualImpact', label: 'Impact Annuel', type: 'text', group: 'Données' },
        { key: 'consequence', label: 'Conséquence', type: 'text', group: 'Contenu' },
        { key: 'note', label: 'Note de bas de page', type: 'text', group: 'Contenu' },
    ],

    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full bg-white overflow-hidden border-4 border-black flex flex-col relative">


                <div className="bg-black px-7 pt-6 pb-5 shrink-0 border-b-4 border-black">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div className="w-2 h-0.5 bg-black"></div></div>
                        <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{state.brand}</span>
                        <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: state.accent }}>CALCULETTE</div>
                    </div>
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                        className="ab block text-white uppercase leading-tight" style={{ fontSize: '1.5rem' }} />
                </div>

                <div className="px-7 py-4 border-b-4 border-black bg-[#F4F4F4] flex items-center gap-4 shrink-0">
                    <div className="px-4 py-2 border-4 border-black bg-black">
                        <span className="ab font-black uppercase text-white" style={{ fontSize: '0.8rem' }}>{state.targetAudience}</span>
                    </div>
                    <div className="h-px flex-1 bg-black"></div>
                    <span className="ab font-black uppercase text-black/30" style={{ fontSize: '0.7rem' }}>COMBIEN ÇA COÛTE ?</span>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    <div className="w-1/2 border-r-4 border-black p-8 flex flex-col items-center justify-center bg-white">
                        <span className="sm font-black uppercase text-black/40 mb-1 tracking-widest" style={{ fontSize: '0.62rem' }}>PAR MOIS</span>
                        <span className="ab font-black leading-none" style={{ fontSize: 'clamp(3.5rem,14vw,5.5rem)', color: state.accent }}>{state.monthlyLoss}</span>
                    </div>
                    <div className="w-1/2 p-8 flex flex-col items-center justify-center bg-black">
                        <span className="sm font-black uppercase text-white/40 mb-1 tracking-widest" style={{ fontSize: '0.62rem' }}>PAR AN</span>
                        <span className="ab font-black leading-none" style={{ fontSize: 'clamp(3rem,12vw,4.5rem)', color: state.accent }}>{state.annualImpact}</span>
                    </div>
                </div>

                <div className="px-7 py-5 border-t-4 border-black bg-[#F4F4F4] shrink-0">
                    <EditZone html={state.consequence} onChange={h => patch({ consequence: h })} label="CONSÉQUENCE" stickerPos="-top-5 right-0"
                        className="sm font-bold text-black leading-relaxed" style={{ fontSize: '0.8rem' }} />
                    <div className="mt-3 pt-2 border-t border-black/20">
                        <span className="sm text-black/40 font-bold uppercase" style={{ fontSize: '0.55rem' }}>{state.note}</span>
                    </div>
                </div>

                <div className="bg-black px-6 py-2.5 border-t-4 border-black shrink-0 flex items-center justify-between">
                    <span className="ab font-black text-white uppercase tracking-wide" style={{ fontSize: '0.65rem' }}>{state.brand}</span>
                </div>
            </div>
        );
    }
};
