import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';
import { Aesthetics } from '../core/Aesthetics';

export const MaxTextTemplate: StudioTemplate = {
    id: 'MAXTEXT',
    name: 'Analyse Longue',
    category: 'Editorial',
    description: 'Template optimisé pour les longs paragraphes et les citations.',

    defaultState: {
        accent: '#DC2626',
        brand: 'L\'ASSEZ',
        headline: 'L\'IMPACT DU DESIGN SUR<br/>L\'OPINION PUBLIQUE',
        leadParagraph: 'Le design graphique n\'est jamais neutre. Il oriente le regard, hiérarchise l\'information et impose un rythme de lecture qui influence directement la perception du message.',
        bodyParagraph: 'Dans un monde saturé d\'images, la clarté devient une forme de résistance. En utilisant des codes visuels brutaux et directs, nous forçons l\'attention sur l\'essentiel.',
        showQuote: true,
        quote: 'Le style est une manière de dire qui vous êtes sans avoir à parler.',
        quoteAuthor: 'RACHEL ZOE',
        showDate: true,
        date: '03 MAI 2026',
        showSource: true,
        source: 'ARCHIVES STUDIO'
    },

    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'brand', label: 'Marque', type: 'text', group: 'Infos' },
        { key: 'headline', label: 'Titre', type: 'text', group: 'Contenu' },
        { key: 'leadParagraph', label: 'Paragraphe d\'Accroche', type: 'text', group: 'Contenu' },
        { key: 'bodyParagraph', label: 'Corps de Texte', type: 'text', group: 'Contenu' },
        { key: 'showQuote', label: 'Afficher Citation', type: 'boolean', group: 'Citation' },
        { key: 'quote', label: 'Texte Citation', type: 'text', group: 'Citation' },
        { key: 'quoteAuthor', label: 'Auteur Citation', type: 'text', group: 'Citation' },
        { key: 'showDate', label: 'Afficher Date', type: 'boolean', group: 'Pied de page' },
        { key: 'date', label: 'Date', type: 'text', group: 'Pied de page' },
        { key: 'showSource', label: 'Afficher Source', type: 'boolean', group: 'Pied de page' },
        { key: 'source', label: 'Source', type: 'text', group: 'Pied de page' },
    ],

    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full border-[6px] border-black overflow-hidden flex flex-col relative" style={{ backgroundColor: '#F9FAFB' }}>


                <div className="absolute top-0 right-0 z-30 flex">
                    <EditZone 
                        html={state.brand} 
                        onChange={h => patch({ brand: h })} 
                        label="MARQUE" 
                        stickerPos="top-6 right-0"
                        className="sm font-bold text-[10px] uppercase tracking-widest px-3 py-1 border-b-2 border-l-2 border-black text-white" 
                        style={{ backgroundColor: state.accent }}
                    />
                </div>

                <div className="relative z-10 flex-grow flex flex-col px-8 pt-8 pb-3 overflow-hidden">
                    <div className="relative mb-6 pb-3 border-b-2 border-black">
                        <EditZone
                            html={state.headline}
                            onChange={h => patch({ headline: h })}
                            label="TITRE"
                            stickerPos="-top-6 left-0"
                            className="pd font-bold text-[30px] leading-tight text-black"
                        />
                        <div className="absolute -bottom-[2px] left-0 h-[3px] w-1/4" style={{ backgroundColor: state.accent }}></div>
                    </div>

                    <div className="flex-grow overflow-hidden flex flex-col gap-2">
                        <EditZone
                            html={state.leadParagraph}
                            onChange={h => patch({ leadParagraph: h })}
                            label="ANALYSE"
                            stickerPos="-top-5 left-0"
                            className="ir text-[17px] leading-[1.65] text-black text-justify mb-2 maxtext-body"
                        />
                        <EditZone
                            html={state.bodyParagraph}
                            onChange={h => patch({ bodyParagraph: h })}
                            label="DÉTAIL"
                            stickerPos="-top-5 right-0"
                            className="sm text-[14px] leading-[1.6] text-gray-700 text-justify mb-2 maxtext-body"
                        />
                    </div>

                    {state.showQuote && (
                        <div className="relative border-l-2 p-3 bg-gray-100/50 mt-auto" style={{ borderColor: state.accent }}>
                            <EditZone
                                html={state.quote}
                                onChange={h => patch({ quote: h })}
                                label="CITATION"
                                stickerPos="-top-5 left-0"
                                className="sm text-[13px] leading-snug text-black italic"
                            />
                            <EditZone 
                                html={state.quoteAuthor} 
                                onChange={h => patch({ quoteAuthor: h })} 
                                label="AUTEUR" 
                                stickerPos="top-6 right-0"
                                className="sm text-[10px] uppercase font-bold mt-1 block" 
                                style={{ color: state.accent }}
                            />
                        </div>
                    )}
                </div>

                {(state.showDate || state.showSource) && (
                    <div className="border-t border-dashed border-gray-400 px-8 py-2 flex justify-between items-end shrink-0 bg-[#F9FAFB] z-10">
                        {state.showDate ? (
                            <div className="flex flex-col">
                                <span className="sm text-[8px] uppercase text-gray-400">Date</span>
                                <EditZone 
                                    html={state.date} 
                                    onChange={h => patch({ date: h })} 
                                    label="DATE" 
                                    stickerPos="-top-4 left-0"
                                    className="sm font-bold text-[11px] text-black" 
                                />
                            </div>
                        ) : <div />}
                        {state.showSource && (
                            <div className="flex flex-col text-right">
                                <span className="sm text-[8px] uppercase text-gray-400">Source</span>
                                <EditZone 
                                    html={state.source} 
                                    onChange={h => patch({ source: h })} 
                                    label="SOURCE" 
                                    stickerPos="-top-4 right-0"
                                    className="sm font-bold text-[11px] text-black" 
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    }
};
