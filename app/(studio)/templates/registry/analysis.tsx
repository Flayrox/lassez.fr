import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const AnalysisTemplate: StudioTemplate = {
    id: 'ANALYSIS',
    name: 'Analyse Listée',
    category: 'Analyse',
    description: 'Une liste de 3 points clés analysés avec un arrière-plan texturé.',

    defaultState: {
        headline: "L'Assez Analysis",
        brand: "L'ASSEZ",
        accent: "#DC2626",
        refCode: "Ref: 24-0B // V.02",
        slideNum: "02",
        totalSlides: "10",
        imageUrl: 'https://picsum.photos/seed/lassez-analysis/1200/800',
        item1Num: "01",
        item1Title: "Redondance Systémique",
        item1Text: "L'architecture actuelle priorise des protocoles obsolètes.",
        item2Num: "02",
        item2Title: "Biais Algorithmique",
        item2Text: "Les flux d'information sont bridés par des gardiens opaques.",
        item3Num: "03",
        item3Title: "Extraction des Ressources",
        item3Text: "L'attention est la matière première principale.",
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'imageUrl', label: 'Image Fond', type: 'text', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'refCode', label: 'Code Réf', type: 'text', group: 'Meta' },
        { key: 'slideNum', label: 'N° Slide', type: 'text', group: 'Meta' },
        { key: 'totalSlides', label: 'Total Slides', type: 'text', group: 'Meta' },
        { key: 'item1Num', label: 'N° Item 1', type: 'text', group: 'Item 1' },
        { key: 'item1Title', label: 'Titre Item 1', type: 'text', group: 'Item 1' },
        { key: 'item1Text', label: 'Texte Item 1', type: 'text', group: 'Item 1' },
        { key: 'item2Num', label: 'N° Item 2', type: 'text', group: 'Item 2' },
        { key: 'item2Title', label: 'Titre Item 2', type: 'text', group: 'Item 2' },
        { key: 'item2Text', label: 'Texte Item 2', type: 'text', group: 'Item 2' },
        { key: 'item3Num', label: 'N° Item 3', type: 'text', group: 'Item 3' },
        { key: 'item3Title', label: 'Titre Item 3', type: 'text', group: 'Item 3' },
        { key: 'item3Text', label: 'Texte Item 3', type: 'text', group: 'Item 3' },
    ],


    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full bg-[#0F0F0F] overflow-hidden border-2 border-white/10 flex flex-col group relative">
                <div className="absolute inset-0 z-0">
                    <img alt="Background" className="w-full h-full object-cover opacity-30" style={{ filter: 'grayscale(1) contrast(1.25)' }} src={state.imageUrl} crossOrigin="anonymous" />

                </div>

                <header className="relative z-30 w-full bg-[#DC2626] border-b-4 border-black px-4 py-3 flex justify-between items-center shrink-0" style={{ backgroundColor: state.accent }}>
                    <div className="flex items-center gap-2">
                        <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                            className="ab text-white text-xl tracking-tighter uppercase leading-none" />
                    </div>
                    <div className="bg-black text-white px-2 py-1 font-mono text-[10px] uppercase tracking-tighter">
                        <EditZone html={state.refCode} onChange={h => patch({ refCode: h })} label="REF" stickerPos="bottom-0 right-0" />
                    </div>
                </header>

                <main className="relative z-20 flex-grow p-6 flex flex-col justify-between gap-4">
                    {[1, 2, 3].map(num => (
                        <div key={num} className="relative bg-white p-4 border-2 border-black" style={{ boxShadow: '10px 10px 0px 0px rgba(0,0,0,1)' }}>
                            <div className="flex items-start gap-4">
                                <span className="ab text-4xl leading-none" style={{ color: state.accent }}>{(state as any)[`item${num}Num`]}</span>
                                <div className="flex-1 w-full min-w-0">
                                    <EditZone html={(state as any)[`item${num}Title`]} onChange={h => patch({ [`item${num}Title`]: h })} label={`TITRE ${num}`} stickerPos="-top-4 left-0"
                                        className="ab text-black text-lg uppercase leading-none mb-1 break-words whitespace-normal" />
                                    <EditZone html={(state as any)[`item${num}Text`]} onChange={h => patch({ [`item${num}Text`]: h })} label={`TEXTE ${num}`} stickerPos="top-0 right-0"
                                        className="ir text-black text-xs font-semibold leading-tight break-words whitespace-normal" />
                                </div>
                            </div>
                        </div>
                    ))}
                </main>

                <footer className="relative z-30 flex items-center justify-between px-6 pb-6 pt-2 shrink-0">
                    <div className="h-1 flex-grow bg-white/20 mr-4 flex">
                        <div className="w-2/5 h-full" style={{ backgroundColor: state.accent }}></div>
                    </div>
                    <span className="font-mono text-white text-[10px] tracking-widest uppercase shrink-0">Slide {state.slideNum} / {state.totalSlides}</span>
                </footer>
            </div>
        );
    }
};
