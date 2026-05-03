import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { DraggableImage } from '../components/DraggableMedia';
import { Aesthetics } from '../core/Aesthetics';

export const NewsTemplate: StudioTemplate = {
    id: 'NEWS',
    name: 'Actualités Flash',
    category: 'Information',
    description: 'Rendu type "breaking news" avec une grande image en haut.',
    
    defaultState: {
        accent: '#DC2626',
        brand: 'L\'ASSEZ',
        category: 'FLASH',
        imageUrl: '',
        zoom: 1,
        grayscale: 0,
        posX: 0,
        posY: 0,
        date: '03 MAI 2026',
        topic: 'ANALYSE DU JOUR',
        headline: 'DÉCRYPTAGE DU<br/>NOUVEAU SYSTÈME'
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
        { key: 'category', label: 'Catégorie', type: 'text', group: 'Infos' },
        { key: 'imageUrl', label: 'Image', type: 'image', group: 'Média' },
        { key: 'grayscale', label: 'Grisaille', type: 'number', group: 'Média', props: { min: 0, max: 100 } },
        { key: 'zoom', label: 'Zoom', type: 'number', group: 'Média', props: { min: 0.1, max: 3, step: 0.1 } },
        { key: 'date', label: 'Date', type: 'text', group: 'Contenu' },
        { key: 'topic', label: 'Sujet', type: 'text', group: 'Contenu' },
        { key: 'headline', label: 'Titre', type: 'text', group: 'Contenu' },
    ],
    
    shadowStyle: () => ({
        boxShadow: '0 0 50px rgba(0,0,0,.7)'
    }),
    
    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full bg-white border-[8px] border-black overflow-hidden flex flex-col relative">
                
                
                <div className="relative h-[60%] border-b-[8px] border-black overflow-hidden bg-zinc-700 shrink-0">
                    <div className="absolute top-0 left-0 z-30 px-4 py-2 border-r-[4px] border-b-[4px] border-black" style={{ backgroundColor: state.accent }}>
                        <span className="sm text-white text-[9px] tracking-[0.2em] uppercase font-bold">{state.brand} {state.category}</span>
                    </div>
                    
                    <DraggableImage 
                        src={state.imageUrl} zoom={state.zoom} grayscale={state.grayscale} 
                        posX={state.posX} posY={state.posY} 
                        onPosChange={(x, y) => patch({ posX: x, posY: y })} 
                    />
                    
                    <Aesthetics.Halftone opacity={0.15} zIndex={10} />
                </div>
                
                <div className="flex-1 bg-white px-6 pt-4 pb-5 flex flex-col justify-between text-black">
                    <div className="flex justify-between items-center border-b-2 border-black pb-2">
                        <span className="sm text-[9px] font-bold uppercase tracking-widest">{state.date}</span>
                        <span className="sm text-[9px] font-bold uppercase tracking-widest">{state.topic}</span>
                    </div>
                    
                    <div className="flex-1 flex items-center py-2">
                        <EditZone 
                            html={state.headline} 
                            onChange={h => patch({ headline: h })} 
                            label="TITRE" 
                            stickerPos="-top-5 left-0"
                            className="pd font-black text-[40px] leading-[0.9] uppercase text-black" 
                        />
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <span className="sm text-[8px] uppercase text-zinc-400 font-bold">Rédaction Quotidienne</span>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[9px] uppercase tracking-widest">Lire la suite</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={state.accent} strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
};
