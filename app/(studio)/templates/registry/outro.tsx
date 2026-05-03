import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';

export const OutroTemplate: StudioTemplate = {
    id: 'OUTRO',
    name: 'Call to Action / Outro',
    category: 'Fin',
    description: 'Une slide de fin pour encourager à s\'abonner ou suivre un lien.',
    
    defaultState: {
        headline: `<span class="block relative">S'A<span class="absolute -top-4 -right-4 text-4xl text-white font-grotesk animate-bounce">*</span></span><span class="block ml-12">BON</span><span class="block -ml-8">NER</span>`,
        brandHandle: "@L_ASSEZ_MEDIA",
        accent: "#DC2626",
        linkText: "Lien en bio",
        footerYear: "EST. 2024",
        number: "04"
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre CTA', type: 'text', group: 'Contenu' },
        { key: 'brandHandle', label: 'Handle @', type: 'text', group: 'Infos' },
        { key: 'linkText', label: 'Texte Lien', type: 'text', group: 'Infos' },
        { key: 'footerYear', label: 'Année Footer', type: 'text', group: 'Meta' },
        { key: 'number', label: 'N° Outro', type: 'text', group: 'Meta' },
    ],
    
    shadowStyle: (state) => ({
        boxShadow: `0 0 50px ${state.accent}44`
    }),
    
    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full overflow-hidden flex flex-col group border-4 border-black relative" style={{ backgroundColor: state.accent }}>
                <div className="absolute top-0 left-0 w-24 h-24 bg-black z-10" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }}></div>
                <div className="absolute top-0 left-0 w-32 h-32 border-r-4 border-b-4 border-black z-0"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-black z-10" style={{ clipPath: 'polygon(100% 100%, 0 100%, 100% 0)' }}></div>
                
                <div className="flex-1 flex flex-col justify-center items-center relative z-20 p-8">
                    <div className="absolute top-8 right-8">
                        <span className="bg-black text-white px-4 py-1 sg text-sm font-bold uppercase tracking-widest border border-white transform -rotate-2 inline-block shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]">
                            Rejoignez la lutte
                        </span>
                    </div>
                    
                    <div className="relative w-full text-center my-auto transform rotate-[-5deg]">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[120%] border-4 border-black opacity-20 pointer-events-none"></div>
                        <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-4 right-0"
                            className="pd font-black text-[5.8vw] leading-[0.9] text-black w-full" style={{ mixBlendMode: 'multiply' as any, fontSize: 'clamp(3rem, 15vw, 6rem)' }} />
                    </div>
                    
                    <div className="w-full max-w-[400px] mt-8 space-y-4">
                        <div className="bg-white border-2 border-black p-3 flex items-center justify-between transform rotate-1 transition-transform duration-300" style={{ boxShadow: '4px 4px 0px_0px_rgba(0,0,0,1)' }}>
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                                    </svg>
                                </div>
                                <span className="sg font-bold text-lg text-black">{state.brandHandle}</span>
                            </div>
                            <span className="text-black text-xl leading-none">→</span>
                        </div>
                        <div className="bg-black p-4 text-center transform -rotate-1 transition-transform duration-300 border-2 border-white">
                            <p className="sg font-black text-xl uppercase tracking-wider text-white flex items-center justify-center gap-2">
                                <span className="text-sm">🔗</span>
                                {state.linkText}
                                <span className="text-sm">🔗</span>
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="absolute bottom-8 left-8 flex flex-col gap-1 z-20">
                    <div className="w-16 h-1 bg-black"></div>
                    <div className="w-12 h-1 bg-black"></div>
                    <div className="w-20 h-1 bg-black"></div>
                    <div className="w-8 h-1 bg-black"></div>
                    <span className="text-[10px] font-mono font-bold mt-1 text-black">{state.footerYear}</span>
                </div>
                
                <div className="absolute -bottom-16 -left-4 ir font-black text-[10rem] opacity-10 pointer-events-none select-none text-black">
                    {state.number}
                </div>
            </div>
        );
    }
};
