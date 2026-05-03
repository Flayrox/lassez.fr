import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { getSafeImageUrl } from '../core/utils';

export const AnalysisTemplate: StudioTemplate = {
    id: 'ANALYSIS',
    name: 'Analyse Listée',
    category: 'Analyse',
    description: 'Une liste de points clés analysés avec un arrière-plan texturé.',

    defaultState: {
        headline: "L'Assez Analysis",
        brand: "L'ASSEZ",
        accent: "#DC2626",
        refCode: "Ref: 24-0B // V.02",
        slideNum: "02",
        totalSlides: "10",
        imageUrl: 'https://images.unsplash.com/photo-1504711432813-0b72a692df9a',
        items: [
            { num: "01", title: "Redondance Systémique", text: "L'architecture actuelle priorise des protocoles obsolètes." },
            { num: "02", title: "Biais Algorithmique", text: "Les flux d'information sont bridés par des gardiens opaques." },
            { num: "03", title: "Extraction des Ressources", text: "L'attention est la matière première principale." },
        ]
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'imageUrl', label: 'Image Fond', type: 'text', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'refCode', label: 'Code Réf', type: 'text', group: 'Meta' },
        { key: 'slideNum', label: 'N° Slide', type: 'text', group: 'Meta' },
        { key: 'totalSlides', label: 'Total Slides', type: 'text', group: 'Meta' },
        { 
            key: 'items', label: 'Points d\'Analyse', type: 'list', group: 'Contenu',
            itemSchema: [
                { key: 'num', label: 'N°', type: 'text' },
                { key: 'title', label: 'Titre', type: 'text' },
                { key: 'text', label: 'Texte', type: 'text' },
            ]
        }
    ],

    Component: ({ state, patch }) => {
        const items = state.items || [];

        return (
            <div className="w-full h-full bg-[#0F0F0F] overflow-hidden border-2 border-white/10 flex flex-col group relative">
                <div className="absolute inset-0 z-0">
                    {state.imageUrl && (
                        <img alt="Background" className="w-full h-full object-cover opacity-30" style={{ filter: 'grayscale(1) contrast(1.25)' }} src={getSafeImageUrl(state.imageUrl)} crossOrigin="anonymous" />
                    )}
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

                <main className="relative z-20 flex-grow p-6 flex flex-col justify-center gap-4">
                    {items.map((item: any, i: number) => (
                        <div key={i} className="relative bg-white p-4 border-2 border-black group/item" style={{ boxShadow: '10px 10px 0px 0px rgba(0,0,0,1)' }}>
                            <div className="flex items-start gap-4">
                                <span className="ab text-4xl leading-none" style={{ color: state.accent }}>{item.num}</span>
                                <div className="flex-1 w-full min-w-0">
                                    <EditZone html={item.title} 
                                        onChange={h => {
                                            const newItems = [...items];
                                            newItems[i] = { ...newItems[i], title: h };
                                            patch({ items: newItems });
                                        }} 
                                        label="TITRE" stickerPos="-top-4 left-0"
                                        className="ab text-black text-lg uppercase leading-none mb-1 break-words whitespace-normal" />
                                    <EditZone html={item.text} 
                                        onChange={h => {
                                            const newItems = [...items];
                                            newItems[i] = { ...newItems[i], text: h };
                                            patch({ items: newItems });
                                        }} 
                                        label="TEXTE" stickerPos="top-0 right-0"
                                        className="ir text-black text-xs font-semibold leading-tight break-words whitespace-normal" />
                                </div>
                                <button 
                                    onClick={() => patch({ items: items.filter((_: any, idx: number) => idx !== i) })}
                                    className="opacity-0 group-hover/item:opacity-100 transition-opacity bg-black text-white w-5 h-5 flex items-center justify-center text-[10px]"
                                >✕</button>
                            </div>
                        </div>
                    ))}

                    {items.length < 4 && (
                        <button 
                            onClick={() => patch({ items: [...items, { num: `0${items.length + 1}`, title: "NOUVEAU POINT", text: "Détail de l'analyse..." }] })}
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-10 border-2 border-dashed border-white/30 flex items-center justify-center text-white/50 font-bold uppercase text-[10px] hover:bg-white/5"
                        >
                            + Ajouter un point
                        </button>
                    )}
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
