import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const InfoTemplate: StudioTemplate = {
    id: 'INFO',
    name: 'Fiche Information',
    category: 'Analyse',
    description: 'Une fiche détaillée avec deux blocs de texte et un tag de catégorie.',

    defaultState: {
        headline: "DÉCORTIQUER<br/>LE SYSTÈME",
        brand: "L'ASSEZ",
        accent: "#DC2626",
        tag: "Flash Info",
        slideNum: "02",
        body: `L'audit confirme que plus de <span style="background:#000;color:#fff;padding:0 4px;text-decoration:underline;text-decoration-color:#DC2626;text-decoration-thickness:3px;font-weight:700">60% des promesses</span> sont restées lettre morte.`,
        bodyMono: "L'Show analyse montre que ce mécanisme d'opacité est délibérément intégré dans la loi pour protéger les profits au détriment du service public.",
        actionTitle: "Action Requise Immédiate",
        actionMeta: "Dossier #12.04 — Secteur 4",
        footerHandle: "@LASSEZmedia",
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'tag', label: 'Étiquette', type: 'text', group: 'Meta' },
        { key: 'slideNum', label: 'N° Slide', type: 'text', group: 'Meta' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'body', label: 'Corps (Gras)', type: 'text', group: 'Contenu' },
        { key: 'bodyMono', label: 'Corps (Détail)', type: 'text', group: 'Contenu' },
        { key: 'actionTitle', label: 'Titre Alerte', type: 'text', group: 'Alerte' },
        { key: 'actionMeta', label: 'Meta Alerte', type: 'text', group: 'Alerte' },
        { key: 'footerHandle', label: 'Handle Footer', type: 'text', group: 'Meta' },
    ],

    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full overflow-hidden border-4 border-black flex flex-col relative" style={{ backgroundColor: '#F3F4F6' }}>
                {/* Geometrical accents */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <div style={{
                        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
                        backgroundColor: '#000', borderLeft: `8px solid ${state.accent}`,
                        opacity: 0.1, transform: 'skewX(-12deg) translateX(25%)'
                    }}></div>
                    <div style={{ position: 'absolute', top: '15%', left: 0, width: '100%', height: 8, backgroundColor: '#000', transform: 'rotate(-1deg)' }}></div>
                    <div style={{ position: 'absolute', bottom: '10%', left: 0, width: '100%', height: 16, backgroundColor: '#000', transform: 'rotate(1deg)' }}></div>
                </div>



                <header className="relative z-20 px-8 pt-10 pb-4 flex justify-between items-end border-b-4 border-black bg-white shrink-0">
                    <div className="flex flex-col">
                        <span className="sm text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: state.accent }}>{state.tag}</span>
                        <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                            className="pd font-black text-[36px] leading-none text-black uppercase tracking-tighter" />
                    </div>
                    <div className="text-right">
                        <div className="sm text-[36px] font-bold text-black leading-none">{state.slideNum}</div>
                        <div className="sm text-[9px] uppercase text-gray-400">Slide</div>
                    </div>
                </header>

                <main className="relative z-20 flex-grow p-7 flex flex-col justify-between gap-5">
                    <div className="relative bg-white border-2 border-black p-5 flex-grow flex flex-col justify-center" style={{ boxShadow: '8px 8px 0 0 #000' }}>
                        <EditZone html={state.body} onChange={h => patch({ body: h })} label="CORPS" stickerPos="-top-5 right-0"
                            className="pd text-[20px] font-bold leading-tight text-black mb-3" />
                        <EditZone html={state.bodyMono} onChange={h => patch({ bodyMono: h })} label="CORPS 2" stickerPos="-top-5 left-0"
                            className="sm text-[11px] leading-relaxed text-gray-700 text-justify border-l-4 pl-3" style={{ borderColor: state.accent }} />
                    </div>

                    <div className="relative">
                        <div className="absolute -top-4 -right-2 px-2 py-1 sm text-[9px] font-bold uppercase z-20 border-2 border-white bg-black text-white" style={{ transform: 'rotate(2deg)' }}>Warning</div>
                        <div className="p-5 border-4 border-black relative" style={{
                            backgroundColor: state.accent,
                            boxShadow: '4px 4px 0 0 #000',
                            clipPath: 'polygon(0% 0%,100% 0%,100% 100%,95% 93%,90% 100%,85% 93%,80% 100%,75% 93%,70% 100%,65% 93%,60% 100%,55% 93%,50% 100%,45% 93%,40% 100%,35% 93%,30% 100%,25% 93%,20% 100%,15% 93%,10% 100%,5% 93%,0% 100%)'
                        }}>
                            <div className="flex flex-col text-white">
                                <h2 className="ab text-[28px] uppercase leading-none text-white mb-1" style={{ mixBlendMode: 'hard-light' as any }}>{state.actionTitle}</h2>
                                <p className="sm text-[10px] font-bold uppercase text-black tracking-wider">{state.actionMeta}</p>
                            </div>
                        </div>
                    </div>
                </main>

                <footer className="relative z-20 bg-black text-white px-5 py-3 flex justify-between items-center mt-auto border-t-4 shrink-0" style={{ borderColor: state.accent }}>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full border border-white" style={{ backgroundColor: state.accent }}></div>
                        <span className="ab text-[18px] uppercase tracking-widest">{state.brand}</span>
                    </div>
                    <span className="sm text-[10px]">{state.footerHandle}</span>
                </footer>
            </div>
        );
    }
};
