import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { DraggableImage } from '../components/DraggableMedia';
import { Aesthetics } from '../core/Aesthetics';

export const CoverTemplate: StudioTemplate = {
    id: 'COVER',
    name: 'Couverture Magazine',
    category: 'Editorial',
    description: 'Template de couverture classique avec titre incliné.',
    
    defaultState: {
        bg: '#FFFFFF',
        accent: '#DC2626',
        imageUrl: '',
        zoom: 1,
        grayscale: 0,
        posX: 0,
        posY: 0,
        issueNum: '01',
        brand: 'L\'ASSEZ STUDIO',
        headline: 'LE NOUVEAU<br/>PARADIGME',
        readTime: '12 MIN',
        author: 'RÉDACTION',
        swipeLabel: 'VOIR L\'ANALYSE'
    },
    
    schema: [
        { key: 'bg', label: 'Couleur de Fond', type: 'color', group: 'Style' },
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'imageUrl', label: 'Image', type: 'image', group: 'Média' },
        { key: 'grayscale', label: 'Grisaille', type: 'number', group: 'Média', props: { min: 0, max: 100 } },
        { key: 'zoom', label: 'Zoom', type: 'number', group: 'Média', props: { min: 0.1, max: 3, step: 0.1 } },
        { key: 'headline', label: 'Titre', type: 'text', group: 'Contenu' },
        { key: 'issueNum', label: 'Numéro Issue', type: 'text', group: 'Infos' },
        { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
        { key: 'author', label: 'Auteur', type: 'text', group: 'Infos' },
        { key: 'readTime', label: 'Lecture', type: 'text', group: 'Infos' },
        { key: 'swipeLabel', label: 'Label Swipe', type: 'text', group: 'Infos' },
    ],
    
    shadowStyle: (state) => ({
        boxShadow: `20px 20px 0 ${state.accent || '#DC2626'}55`
    }),
    
    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full border-[10px] border-black overflow-hidden relative" style={{ backgroundColor: state.bg }}>
                <DraggableImage 
                    src={state.imageUrl} zoom={state.zoom} grayscale={state.grayscale} 
                    posX={state.posX} posY={state.posY} 
                    onPosChange={(x, y) => patch({ posX: x, posY: y })} 
                />
                
                <Aesthetics.Halftone opacity={0.25} zIndex={10} />
                
                
                <div className="relative z-30 h-full flex flex-col justify-between p-9">
                    <div className="flex justify-between items-start border-b-[3px] border-black pb-3">
                        <span className="sm text-[9px] font-bold uppercase tracking-widest bg-black text-white px-2.5 py-1">Issue #{state.issueNum}</span>
                        <span className="sm text-[9px] uppercase tracking-widest text-black font-bold">{state.brand}</span>
                    </div>
                    
                    <div className="flex-grow flex items-center justify-center relative">
                        <div className="absolute inset-x-[-36px] h-48 transform -skew-y-3 border-y-[6px] border-black shadow-xl" style={{ backgroundColor: state.bg }}></div>
                        <EditZone 
                            html={state.headline} 
                            onChange={h => patch({ headline: h })} 
                            label="TITRE" 
                            stickerPos="-top-5 right-0"
                            className="relative z-10 pd font-black text-[76px] leading-[0.82] text-center text-black uppercase italic tracking-tighter" 
                        />
                    </div>
                    
                    <div className="border-t-[6px] border-black pt-4 flex justify-between items-end">
                        <div className="flex flex-col gap-0.5">
                            <span className="sm text-[8px] font-bold uppercase text-black">Temps de lecture: {state.readTime}</span>
                            <span className="sm text-[8px] font-bold uppercase text-black">Auteur: {state.author}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-3 border-l-2 border-black">
                            <span className="font-bold text-[10px] uppercase tracking-widest text-black italic">{state.swipeLabel}</span>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={state.accent} strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                        </div>
                    </div>
                </div>
                
                {/* Décorations fixes */}
                <div className="absolute top-1/3 left-5 w-5 h-5 bg-black z-40"></div>
                <div className="absolute top-1/3 left-12 w-5 h-5 border-[3px] border-black z-40"></div>
                <div className="absolute bottom-10 right-10 rounded-full z-20 mix-blend-hard-light" style={{ width: 88, height: 88, backgroundColor: state.accent }}></div>
            </div>
        );
    }
};
