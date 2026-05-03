import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';
import { DraggableVideo } from '../components/DraggableMedia';

export const VideoNoteTemplate: StudioTemplate = {
    id: 'VIDEO_NOTE',
    name: 'Note Vidéo',
    category: 'Média',
    description: 'Une capture vidéo annotée pour une analyse visuelle.',
    
    defaultState: {
        headline: "ANALYSE DE LA SÉQUENCE #32",
        videoUrl: "",
        videoZoom: 1,
        videoX: 0,
        videoY: 0,
        annotation: "Remarquez la position des forces de l'ordre à 0:14, contredisant le rapport officiel publié hier.",
        brand: "L'ASSEZ",
        accent: "#BC0100",
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre de l\'analyse', type: 'text', group: 'Contenu' },
        { key: 'videoUrl', label: 'URL de la vidéo', type: 'text', group: 'Média' },
        { key: 'videoZoom', label: 'Zoom Vidéo', type: 'number', group: 'Média' },
        { key: 'annotation', label: 'Annotation', type: 'text', group: 'Contenu' },
    ],
    
    shadowStyle: (state) => ({
        boxShadow: `0 0 50px rgba(0,0,0,0.6), 0 0 20px ${state.accent}44`
    }),
    
    Component: ({ state, patch }) => {
        const isYt = (state.videoUrl || '').includes('youtube') || (state.videoUrl || '').includes('youtu.be');

        return (
            <div className="w-full h-full bg-black overflow-hidden border-4 border-black flex flex-col relative">
                
                
                <div className="px-6 pt-5 pb-4 border-b-4 border-white/10 shrink-0 z-10 flex items-center gap-3">
                    <div className="w-3.5 h-3.5 bg-white flex items-center justify-center shrink-0"><div className="w-2 h-0.5 bg-black"></div></div>
                    <span className="ab font-bold uppercase tracking-widest text-white" style={{ fontSize: '0.6rem' }}>{state.brand}</span>
                    <div className="ml-auto px-2 py-0.5 sm text-[9px] font-bold uppercase text-black" style={{ background: state.accent }}>🎬 DOCUMENT VIDÉO</div>
                </div>

                <div className="px-6 py-4 shrink-0 border-b-4 border-white/10 z-10">
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                        className="ab block text-white uppercase leading-tight" style={{ fontSize: '1.6rem' }} />
                </div>

                <div data-export="live" style={{ flex: 1, position: 'relative', background: '#000', overflow: 'hidden', zIndex: 10 }}>
                    {state.videoUrl ? (
                        isYt ? (
                            <iframe
                                className="absolute inset-0 w-full h-full pointer-events-none"
                                src={`https://www.youtube.com/embed/${state.videoUrl.split('v=')[1]?.split('&')[0] || state.videoUrl.split('/').pop()}?autoplay=1&mute=1&controls=0&loop=1`}
                            />
                        ) : (
                            <DraggableVideo 
                                src={state.videoUrl} zoom={state.videoZoom || 1} 
                                posX={state.videoX || 0} posY={state.videoY || 0} 
                                onPosChange={(x,y) => patch({ videoX: x, videoY: y })} 
                            />
                        )
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-white/20">
                            <span className="text-6xl opacity-50">▶</span>
                            <span className="sm text-white/30 uppercase text-[10px] font-bold">Collez une URL vidéo</span>
                        </div>
                    )}
                </div>

                <div className="border-t-4 px-6 py-5 shrink-0 z-10" style={{ borderColor: state.accent, backgroundColor: '#0f0f0f' }}>
                    <div className="flex gap-3 items-start">
                        <div className="w-5 h-5 shrink-0 flex items-center justify-center border-2" style={{ borderColor: state.accent }}>
                            <span className="sm font-black" style={{ fontSize: '0.55rem', color: state.accent }}>!</span>
                        </div>
                        <EditZone html={state.annotation} onChange={h => patch({ annotation: h })} label="ANNOTATION" stickerPos="-top-5 right-0"
                            className="ir font-bold text-white leading-relaxed flex-1" style={{ fontSize: '0.88rem' }} />
                    </div>
                </div>
            </div>
        );
    }
};
