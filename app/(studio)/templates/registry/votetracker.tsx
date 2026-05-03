import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const VoteTrackerTemplate: StudioTemplate = {
    id: 'VOTE_TRACKER',
    name: 'Vote Tracker',
    category: 'Politique',
    description: 'Affiche un registre de votes sur différents sujets ou lois.',
    
    defaultState: {
        accent: '#BC0100',
        brand: 'L\'ASSEZ',
        title: 'VOTE TRACKER',
        subtitle: 'L\'ASSEZ MEDIA — REGISTRE DES VOTES',
        imageUrl: 'https://picsum.photos/seed/lassez-vote/1200/800',
        votes: [
            { law: "Loi sur la transparence financière des élus (Amendement 45B)", vote: "CONTRE" },
            { law: "Réforme des retraites : recul de l'âge légal à 65 ans", vote: "CONTRE" },
            { law: "Augmentation des budgets de la défense nationale", vote: "CONTRE" },
            { law: "Protection renforcée des lanceurs d'alerte", vote: "CONTRE" },
            { law: "Réduction des aides sociales pour les plus précaires", vote: "POUR" },
        ],
        variant: "Fiche 1 / 3",
        colorPour: "#1A1C1C",
        colorContre: "#BC0100",
        colorAbst: "#888888",
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'title', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'subtitle', label: 'Sous-titre', type: 'text', group: 'Contenu' },
        { key: 'variant', label: 'Label Variante', type: 'text', group: 'Contenu' },
        { key: 'imageUrl', label: 'URL Image', type: 'text', group: 'Média' },
        { key: 'colorPour', label: 'Couleur POUR', type: 'color', group: 'Légende' },
        { key: 'colorContre', label: 'Couleur CONTRE', type: 'color', group: 'Légende' },
        { key: 'colorAbst', label: 'Couleur ABST', type: 'color', group: 'Légende' },
    ],
    
    shadowStyle: (state) => ({
        boxShadow: `0 0 40px rgba(0,0,0,0.2), 10px 10px 0 ${state.accent}22`
    }),
    
    Component: ({ state, patch }) => {
        const colorPour = state.colorPour ?? '#1A1C1C';
        const colorContre = state.colorContre ?? '#BC0100';
        const colorAbst = state.colorAbst ?? '#888888';

        return (
            <div className="w-full h-full bg-white overflow-hidden border-4 border-black flex flex-col relative"
                style={{ backgroundImage: 'linear-gradient(#d4d4d4 1px, transparent 1px), linear-gradient(90deg, #d4d4d4 1px, transparent 1px)', backgroundSize: '52px 52px' }}>
                
                
                <div className="relative bg-white border-b-4 border-black shrink-0 overflow-hidden z-10">
                    {state.imageUrl && (
                        <div className="absolute top-0 right-0 w-36 h-44 overflow-hidden" style={{ filter: 'grayscale(100%) contrast(1.4)' }}>
                            <img src={state.imageUrl} alt="" className="w-full h-full object-cover object-top" crossOrigin="anonymous" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(to left, transparent 30%, white 85%)' }}></div>
                        </div>
                    )}
                    <div className="relative z-10 p-5 pr-32">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 bg-black flex items-center justify-center shrink-0">
                                <div className="w-2.5 h-0.5 bg-white"></div>
                            </div>
                            <span className="ab font-bold uppercase tracking-widest text-black" style={{ fontSize: '0.65rem' }}>{state.brand}</span>
                        </div>
                        <EditZone html={state.title} onChange={h => patch({ title: h })} label="TITRE" stickerPos="-top-4 right-0"
                            className="ab block font-black uppercase leading-tight text-black" style={{ fontSize: 'clamp(1.4rem, 6vw, 2rem)' }} />
                        <div className="mt-2 inline-block px-3 py-0.5 border-2 border-black" style={{ background: state.accent }}>
                            <EditZone html={state.subtitle} onChange={h => patch({ subtitle: h })} label="SOUS-TITRE" stickerPos="top-0 right-0"
                                className="sm text-white font-bold uppercase" style={{ fontSize: '0.6rem' }} />
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden bg-white z-10">
                    {(state.votes || []).map((vr: any, i: number) => {
                        const voteColor = vr.vote === 'POUR' ? colorPour : vr.vote === 'ABST' ? colorAbst : colorContre;
                        return (
                            <div key={i} className="flex items-stretch border-b-2 border-black/20 flex-1">
                                <div className="flex-1 flex items-center px-4 py-1.5 bg-white border-r-2 border-black/20">
                                    <span className="ir font-bold leading-tight text-black" style={{ fontSize: '0.7rem' }}>{vr.law}</span>
                                </div>
                                <div className="w-24 shrink-0 flex items-center justify-center border-l-2 border-black"
                                    style={{ backgroundColor: voteColor }}>
                                    <span className="ab font-black text-white tracking-tight" style={{ fontSize: 'clamp(1rem, 4.5vw, 1.5rem)' }}>{vr.vote}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="shrink-0 border-t-4 border-black bg-white px-4 py-2.5 flex justify-between items-center z-10">
                    <div className="border-2 border-black px-3 py-1">
                        <EditZone html={state.variant} onChange={h => patch({ variant: h })} label="VARIANT" stickerPos="top-0 right-0"
                            className="sm font-bold uppercase text-black" style={{ fontSize: '0.65rem' }} />
                    </div>
                    <div className="border-2 border-black px-3 py-1" style={{ background: state.accent }}>
                        <span className="ab font-black text-white uppercase" style={{ fontSize: '0.8rem' }}>{state.brand}</span>
                    </div>
                </div>
            </div>
        );
    }
};
