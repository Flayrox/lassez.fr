import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const ManifestoTemplate: StudioTemplate = {
    id: 'MANIFESTO',
    name: 'Manifeste Brut',
    category: 'Editorial',
    description: 'Mise en page bicolore avec deux colonnes de texte.',

    defaultState: {
        accent: '#DC2626',
        brand: 'L\'ASSEZ STUDIO',
        docNum: 'MANIFESTO v1.0',
        headline: 'POUR UNE RÉVOLUTION<br/>VISUELLE ET SOCIALE',
        titleSize: '62px',
        bodyLeft: 'Le design n\'est pas un luxe, c\'est une arme. Chaque pixel doit porter une intention, chaque couleur un message. Nous refusons la neutralité du vide.',
        metaLeft: 'SECTION DÉCODAGE',
        bodyRight: 'L\'information doit être accessible, brute et sans compromis. Nous déconstruisons les récits officiels pour reconstruire une vérité commune.',
        metaRight: 'PRIORITÉ ABSOLUE',
        actionLabel: 'ACTION REQUIS'
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
        { key: 'docNum', label: 'Réf. Document', type: 'text', group: 'Infos' },
        { key: 'headline', label: 'Titre', type: 'text', group: 'Contenu' },
        { key: 'titleSize', label: 'Taille Titre', type: 'text', group: 'Style' },
        { key: 'bodyLeft', label: 'Texte Gauche', type: 'text', group: 'Colonnes' },
        { key: 'metaLeft', label: 'Meta Gauche', type: 'text', group: 'Colonnes' },
        { key: 'bodyRight', label: 'Texte Droit', type: 'text', group: 'Colonnes' },
        { key: 'metaRight', label: 'Meta Droit', type: 'text', group: 'Colonnes' },
        { key: 'actionLabel', label: 'Label Action', type: 'text', group: 'Infos' },
    ],

    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full split-bg border-4 border-black overflow-hidden flex flex-col text-black relative">


                <div className="w-full bg-black h-11 flex items-center justify-between px-5 shrink-0 z-20">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-white"></div>
                        <span className="ab text-white text-base tracking-tighter uppercase">{state.brand.split(' ')[0]}</span>
                    </div>
                    <span className="sm text-white text-[8px] uppercase tracking-widest">{state.docNum}</span>
                </div>

                <div className="flex-grow flex flex-col p-6 overflow-hidden">
                    <EditZone
                        html={state.headline}
                        onChange={h => patch({ headline: h })}
                        label="TITRE"
                        stickerPos="-top-5 right-0"
                        className="pd font-black leading-[0.9] mb-5 tracking-tight"
                        style={{ fontSize: state.titleSize }}
                    />

                    <div className="flex-grow flex gap-5 ir text-[10px] leading-[1.45] overflow-hidden">
                        <div className="w-1/2 flex flex-col overflow-hidden">
                            <EditZone
                                html={state.bodyLeft}
                                onChange={h => patch({ bodyLeft: h })}
                                label="COL. GAUCHE"
                                stickerPos="-top-5 left-0"
                                className="mb-3 font-semibold text-justify"
                            />
                            <div className="mt-auto border-l-[3px] pl-2 py-0.5" style={{ borderColor: state.accent }}>
                                <p className="sm text-[7px] uppercase text-gray-500 mb-0.5">Status:</p>
                                <p className="ab uppercase text-[11px] leading-none">{state.metaLeft}</p>
                            </div>
                        </div>

                        <div className="w-1/2 flex flex-col overflow-hidden">
                            <EditZone
                                html={state.bodyRight}
                                onChange={h => patch({ bodyRight: h })}
                                label="COL. DROITE"
                                stickerPos="-top-5 right-0"
                                className="mb-3 text-justify"
                            />
                            <div className="mt-auto bg-black text-white p-2">
                                <div className="flex items-center gap-1 mb-1">
                                    <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" /></svg>
                                    <span className="sm text-[7px] uppercase">{state.actionLabel}</span>
                                </div>
                                <p className="ab text-[10px] uppercase leading-none">{state.metaRight}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-2.5 w-full flex shrink-0">
                    <div className="w-1/2 bg-black border-r border-white"></div>
                    <div className="w-1/2" style={{ backgroundColor: state.accent }}></div>
                </div>

                <div className="absolute top-[44px] bottom-[10px] left-1/2 w-px bg-black opacity-10 pointer-events-none"></div>
            </div>
        );
    }
};
