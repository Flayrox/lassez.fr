import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const GranularTemplate: StudioTemplate = {
    id: 'GRANULAR',
    name: 'Données Granulaires',
    category: 'Analyse',
    description: 'Design brutaliste avec arrière-plan géométrique et citations en bloc.',

    defaultState: {
        accent: '#DC2626',
        dark: false,
        tag: 'DÉCRYPTAGE',
        headline: 'LES RESSORTS DE<br/>LA MANIPULATION',
        slideNum: '04',
        body: 'La répétition est la clé de l\'ancrage mémoriel.',
        bodyMono: 'En martelant un message court et simple, les structures de pouvoir s\'assurent une adhésion irréfléchie de la part du public cible.',
        quote: 'LE DESIGN EST UN OUTIL DE CONTRÔLE SOCIAL.',
        brand: 'L\'ASSEZ STUDIO',
        footerHandle: '@lassez_studio'
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'dark', label: 'Mode Sombre', type: 'boolean', group: 'Style' },
        { key: 'tag', label: 'Tag', type: 'text', group: 'Infos' },
        { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
        { key: 'headline', label: 'Titre', type: 'text', group: 'Contenu' },
        { key: 'slideNum', label: 'N° Slide', type: 'text', group: 'Infos' },
        { key: 'body', label: 'Corps (Gras)', type: 'text', group: 'Contenu' },
        { key: 'bodyMono', label: 'Corps (Petit)', type: 'text', group: 'Contenu' },
        { key: 'quote', label: 'Citation', type: 'text', group: 'Citation' },
        { key: 'footerHandle', label: 'Handle Réseaux', type: 'text', group: 'Infos' },
    ],

    Component: ({ state, patch }) => {
        const isDark = state.dark;
        const textColor = isDark ? '#fff' : '#000';
        const bgColor = isDark ? '#0F0F0F' : '#F3F4F6';
        const panelColor = isDark ? '#18181b' : '#fff';

        return (
            <div className="w-full h-full overflow-hidden border-4 border-black flex flex-col relative"
                style={{ backgroundColor: bgColor, color: textColor }}>

                {/* Background Decor */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    <div style={{
                        position: 'absolute', top: 0, right: 0, width: '60%', height: '100%',
                        backgroundColor: isDark ? '#fff' : '#000', borderLeft: `8px solid ${state.accent}`,
                        opacity: 0.1, transform: 'skewX(-12deg) translateX(25%)'
                    }}></div>
                    <div style={{ position: 'absolute', top: '15%', left: 0, width: '100%', height: 8, backgroundColor: isDark ? '#fff' : '#000', transform: 'rotate(-1deg)' }}></div>
                    <div style={{ position: 'absolute', bottom: '10%', left: 0, width: '100%', height: 16, backgroundColor: isDark ? '#fff' : '#000', transform: 'rotate(1deg)' }}></div>
                </div>



                <header className="relative z-10 px-8 pt-10 pb-4 flex justify-between items-end border-b-4 shrink-0"
                    style={{ borderColor: isDark ? '#fff' : '#000', backgroundColor: isDark ? '#000' : '#fff' }}>
                    <div className="flex flex-col">
                        <span className="sm text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color: state.accent }}>{state.tag}</span>
                        <EditZone
                            html={state.headline}
                            onChange={h => patch({ headline: h })}
                            label="TITRE"
                            stickerPos="-top-5 right-0"
                            className="ab text-[36px] leading-none uppercase"
                            style={{ color: textColor }}
                        />
                    </div>
                    <div className="text-right">
                        <div className="sm text-[36px] font-bold leading-none" style={{ color: textColor }}>{state.slideNum}</div>
                        <div className="sm text-[9px] uppercase opacity-40" style={{ color: textColor }}>Slide</div>
                    </div>
                </header>

                <main className="relative z-10 flex-grow p-7 flex flex-col justify-between gap-4">
                    <div className="relative p-5 border-2 flex-grow flex flex-col justify-center" style={{
                        backgroundColor: panelColor,
                        borderColor: isDark ? '#fff' : '#000',
                        boxShadow: `8px 8px 0 ${state.accent}`,
                        transform: 'rotate(1deg)'
                    }}>
                        <EditZone
                            html={state.body}
                            onChange={h => patch({ body: h })}
                            label="CORPS"
                            stickerPos="-top-5 right-0"
                            className="ir text-[22px] font-bold leading-snug mb-4"
                            style={{ color: isDark ? '#e5e5e5' : '#000' }}
                        />
                        <EditZone
                            html={state.bodyMono}
                            onChange={h => patch({ bodyMono: h })}
                            label="CORPS 2"
                            stickerPos="-top-5 left-0"
                            className="sm text-[16px] leading-relaxed text-justify"
                            style={{ opacity: 0.75, color: isDark ? '#aaa' : '#333' }}
                        />
                    </div>

                    <div className="relative">
                        <div className="absolute -top-3 -left-2 px-2 py-1 sm text-[9px] font-bold uppercase z-20"
                            style={{ backgroundColor: isDark ? '#fff' : '#000', color: isDark ? '#000' : '#fff' }}>Témoignage Clé</div>
                        <div className="p-5 border-4 border-black relative overflow-hidden" style={{
                            backgroundColor: state.accent,
                            clipPath: 'polygon(0% 0%,100% 0%,100% 90%,95% 95%,90% 90%,85% 95%,80% 90%,75% 95%,70% 90%,65% 95%,60% 90%,55% 95%,50% 90%,45% 95%,40% 90%,35% 95%,30% 90%,25% 95%,20% 90%,15% 95%,10% 90%,5% 95%,0% 90%)'
                        }}>
                            <EditZone
                                html={state.quote}
                                onChange={h => patch({ quote: h })}
                                label="CITATION"
                                stickerPos="-top-5 left-0"
                                className="ab text-[16px] uppercase leading-tight text-white"
                                style={{ mixBlendMode: 'hard-light' as any }}
                            />
                        </div>
                    </div>
                </main>

                <footer className="relative z-10 px-5 py-3 flex justify-between items-center border-t-4 shrink-0"
                    style={{ backgroundColor: isDark ? '#fff' : '#000', color: isDark ? '#000' : '#fff', borderColor: state.accent }}>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: state.accent }}></div>
                        <span className="ab text-[18px] uppercase tracking-widest">{state.brand}</span>
                    </div>
                    <span className="sm text-[10px]">{state.footerHandle}</span>
                </footer>
            </div>
        );
    }
};
