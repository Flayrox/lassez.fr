import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const BigNumTemplate: StudioTemplate = {
    id: 'BIG_NUM',
    name: 'Chiffre Impact',
    category: 'Analyse',
    description: 'Affiche un grand nombre avec une unité et un sous-titre.',

    defaultState: {
        accent: '#DC2626',
        dark: false,
        brand: 'L\'ASSEZ',
        headline: 'AUGMENTATION DU<br/>COÛT DE LA VIE',
        num: '42%',
        label: 'D\'AUGMENTATION',
        sub: 'Basé sur les données de l\'INSEE pour le premier trimestre 2026.'
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'dark', label: 'Mode Sombre', type: 'boolean', group: 'Style' },
        { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
        { key: 'headline', label: 'Titre', type: 'text', group: 'Contenu' },
        { key: 'num', label: 'Nombre', type: 'text', group: 'Contenu' },
        { key: 'label', label: 'Unité/Label', type: 'text', group: 'Contenu' },
        { key: 'sub', label: 'Description', type: 'text', group: 'Contenu' },
    ],


    Component: ({ state, patch }) => {
        const isDark = state.dark;
        return (
            <div className="w-full h-full overflow-hidden border-4 border-black flex flex-col relative"
                style={{ backgroundColor: isDark ? '#000' : '#fff', color: isDark ? '#fff' : '#000' }}>
                <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: `radial-gradient(${state.accent} 2px, transparent 2px)`, backgroundSize: '24px 24px' }}></div>


                <header className="p-6 border-b-4 border-black flex justify-between items-center z-20 bg-inherit">
                    <EditZone 
                        html={state.brand} 
                        onChange={h => patch({ brand: h })} 
                        label="MARQUE" 
                        stickerPos="top-10 left-0"
                        className="ab text-xl uppercase tracking-tighter" 
                        style={{ color: state.accent }}
                    />
                    <div className="w-8 h-8 flex items-center justify-center border-2 border-black font-bold">!</div>
                </header>

                <main className="flex-1 flex flex-col justify-center items-center p-8 z-20 text-center relative">
                    <EditZone
                        html={state.headline}
                        onChange={h => patch({ headline: h })}
                        label="TITRE"
                        stickerPos="-top-8 left-1/2 -translate-x-1/2"
                        className="sm text-[10px] font-bold uppercase tracking-[.3em] mb-4 opacity-50"
                    />

                    <div className="relative group/num">
                        <EditZone 
                            html={state.num} 
                            onChange={h => patch({ num: h })} 
                            label="NOMBRE" 
                            stickerPos="-top-10 left-1/2 -translate-x-1/2"
                            className="ab text-[180px] leading-none tracking-tighter"
                            style={{ WebkitTextStroke: isDark ? '2px #fff' : '2px #000', color: 'transparent' }}
                        />
                        {/* Overlay effect synced with state */}
                        <span 
                            className="absolute inset-0 ab text-[180px] leading-none tracking-tighter mix-blend-overlay pointer-events-none" 
                            style={{ color: state.accent, opacity: 0.6 }}
                            dangerouslySetInnerHTML={{ __html: state.num }}
                        />
                    </div>

                    <div className="mt-2 bg-black text-white px-5 py-1.5 transform -rotate-1 skew-x-12 inline-block shadow-lg">
                        <EditZone
                            html={state.label}
                            onChange={h => patch({ label: h })}
                            label="UNITÉ"
                            stickerPos="top-8 right-0"
                            className="ab text-2xl font-black uppercase italic"
                        />
                    </div>

                    <div className="mt-8 max-w-[320px]">
                        <EditZone
                            html={state.sub}
                            onChange={h => patch({ sub: h })}
                            label="DÉTAILS"
                            stickerPos="bottom-0"
                            className="ir text-lg font-bold leading-tight"
                        />
                    </div>
                </main>

                <footer className="p-4 border-t-4 border-black flex justify-center z-20 bg-inherit">
                    <div className="flex gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="w-1.5 h-6" style={{ backgroundColor: i % 2 === 0 ? state.accent : (isDark ? '#fff' : '#000') }}></div>
                        ))}
                    </div>
                </footer>
            </div>
        );
    }
};
