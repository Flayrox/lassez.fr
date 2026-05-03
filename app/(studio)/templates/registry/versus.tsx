import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';

export const VersusTemplate: StudioTemplate = {
    id: 'VERSUS',
    name: 'Comparatif Versus',
    category: 'Analyse',
    description: 'Compare deux points de vue ou deux réalités contradictoires.',
    
    defaultState: {
        headline: "DISCOURS VS RÉALITÉ",
        leftTitle: "CE QU'ILS DISENT",
        leftBody: "La sobriété est l'affaire de tous les citoyens.",
        rightTitle: "LA RÉALITÉ",
        rightBody: "Les vols en jets privés ont augmenté de 20% cette année.",
        brand: "L'ASSEZ",
        accent: "#DC2626"
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Bandeau Titre', type: 'text', group: 'Contenu' },
        { key: 'leftTitle', label: 'Titre Gauche', type: 'text', group: 'Gauche' },
        { key: 'leftBody', label: 'Texte Gauche', type: 'text', group: 'Gauche' },
        { key: 'rightTitle', label: 'Titre Droite', type: 'text', group: 'Droite' },
        { key: 'rightBody', label: 'Texte Droite', type: 'text', group: 'Droite' },
    ],
    
    shadowStyle: (state) => ({
        boxShadow: `0 0 40px rgba(0,0,0,0.3), 12px 12px 0 #000`
    }),
    
    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full overflow-hidden border-4 border-black flex flex-col relative">
                <div className="absolute inset-0 flex">
                    {/* Gauche */}
                    <div className="w-1/2 bg-white flex flex-col border-r-2 border-black">
                        <div className="h-14 bg-black text-white flex items-center justify-center ab text-sm uppercase px-4 text-center">
                            <EditZone html={state.leftTitle} onChange={h => patch({ leftTitle: h })} label="TITRE G" stickerPos="top-0" />
                        </div>
                        <div className="flex-1 p-8 flex items-center justify-center text-black text-center relative">
                            <EditZone html={state.leftBody} onChange={h => patch({ leftBody: h })} label="CORPS G" stickerPos="bottom-2"
                                className="ir font-bold text-xl leading-snug italic" />
                        </div>
                    </div>
                    {/* Droite */}
                    <div className="w-1/2 bg-[#0F0F0F] flex flex-col">
                        <div className="h-14 flex items-center justify-center ab text-sm uppercase px-4 text-center text-white" style={{ backgroundColor: state.accent }}>
                            <EditZone html={state.rightTitle} onChange={h => patch({ rightTitle: h })} label="TITRE D" stickerPos="top-0" />
                        </div>
                        <div className="flex-1 p-8 flex items-center justify-center text-white text-center relative">
                            <EditZone html={state.rightBody} onChange={h => patch({ rightBody: h })} label="CORPS D" stickerPos="bottom-2"
                                className="ir font-bold text-xl leading-snug" />
                        </div>
                    </div>
                </div>
                
                {/* VS Badge */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                    <div className="w-20 h-20 bg-black border-4 border-white flex items-center justify-center ab text-4xl text-white italic transform -rotate-12 shadow-2xl">VS</div>
                </div>
                
                {/* Headline Banner */}
                <div className="absolute top-0 left-0 w-full z-10 p-3 pointer-events-none">
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="BANNER" stickerPos="top-5 right-5"
                        className="sm text-[8px] font-black uppercase tracking-[0.4em] text-center bg-white/10 backdrop-blur-sm py-1 border border-black/10 text-gray-500" />
                </div>
                
                <div className="absolute bottom-5 left-5 ab text-[12px] opacity-20 pointer-events-none">L'ASSEZ / DECODAGE</div>
            </div>
        );
    }
};
