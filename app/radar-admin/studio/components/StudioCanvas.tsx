'use client';

import React from 'react';
import { useStudio } from './StudioContext';
import { EditZone } from './EditZone';
import { DraggableImage, DraggableVideo } from './DraggableMedia';

export function StudioCanvas({ exportRef }: { exportRef: React.RefObject<HTMLDivElement | null> }) {
    const { activeSlide, patchActive } = useStudio();
    
    if (!activeSlide) return null;

    const { type: template, state: activeState } = activeSlide;

    // Helper for patching state
    const patch = (p: any) => patchActive(p);

    // Template-specific renders (extracted from page.tsx)
    const renderTemplate = () => {
        switch (template) {
            case 'COVER':
                const cover = activeState;
                return (
                    <div className="w-full h-full flex flex-col relative overflow-hidden" style={{ background: cover.bg }}>
                        <DraggableImage 
                            src={cover.imageUrl} zoom={cover.zoom} grayscale={cover.grayscale} 
                            posX={cover.posX} posY={cover.posY} 
                            onPosChange={(x, y) => patch({ posX: x, posY: y })} 
                        />
                        <div className="absolute inset-0 halftone opacity-30"></div>
                        <div className="absolute inset-0 border-[30px]" style={{ borderColor: cover.accent }}></div>
                        <div className="relative z-10 flex-1 flex flex-col p-16">
                            <div className="flex justify-between items-start mb-auto">
                                <div className="bg-black text-white px-4 py-2 ab text-2xl tracking-tighter">{cover.brand}</div>
                                <div className="sm text-xs font-black uppercase tracking-[0.3em] vertical-text" style={{ color: cover.accent }}>N° {cover.issueNum}</div>
                            </div>
                            <EditZone 
                                html={cover.headline} onChange={h => patch({ headline: h })} 
                                className="ab text-[120px] leading-[0.85] text-black tracking-tighter" 
                            />
                        </div>
                        <div className="relative z-10 p-16 flex justify-between items-end">
                            <div className="sm text-[10px] font-bold uppercase tracking-widest text-black flex flex-col gap-1">
                                <span>{cover.author}</span>
                                <span className="opacity-40">{cover.readTime} LECTURE</span>
                            </div>
                            <div className="sm text-[10px] font-bold uppercase tracking-widest text-black flex items-center gap-3">
                                {cover.swipeLabel} <span style={{ color: cover.accent }}>→</span>
                            </div>
                        </div>
                    </div>
                );

            case 'NEWS':
                const news = activeState;
                return (
                    <div className="w-full h-full bg-white flex flex-col relative overflow-hidden">
                        <div className="h-2/3 relative overflow-hidden">
                            <DraggableImage 
                                src={news.imageUrl} zoom={news.zoom} grayscale={news.grayscale} 
                                posX={news.posX} posY={news.posY} 
                                onPosChange={(x, y) => patch({ posX: x, posY: y })} 
                            />
                            <div className="absolute inset-0 noise-overlay"></div>
                            <div className="absolute bottom-0 left-0 bg-black text-white px-6 py-3 ab text-3xl">{news.brand}</div>
                        </div>
                        <div className="flex-1 p-12 flex flex-col">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="bg-black text-white px-3 py-1 sm text-[10px] font-bold uppercase tracking-widest">{news.category}</div>
                                <div className="sm text-[10px] font-bold uppercase tracking-widest text-gray-400">{news.date} — {news.topic}</div>
                            </div>
                            <EditZone 
                                html={news.headline} onChange={h => patch({ headline: h })} 
                                className="ab text-7xl leading-[0.9] text-black tracking-tight" 
                            />
                        </div>
                        <div className="absolute top-0 right-0 w-1/4 h-full border-l border-black/5 pointer-events-none"></div>
                    </div>
                );
            
            case 'MAXTEXT':
                const mx = activeState;
                return (
                    <div className="w-full h-full bg-white flex flex-col p-12 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-10 border-b-4 border-black pb-6">
                            <div className="ab text-4xl">{mx.brand}</div>
                            <div className="text-right">
                                <p className="sm text-[10px] font-black uppercase tracking-widest">{mx.tag}</p>
                                <p className="sm text-[9px] text-gray-400 uppercase">{mx.date}</p>
                            </div>
                        </div>
                        <EditZone 
                            html={mx.headline} onChange={h => patch({ headline: h })} 
                            className="ab text-5xl leading-tight mb-8 tracking-tight" 
                        />
                        <div className="flex-1 flex flex-col gap-6 maxtext-body">
                            <EditZone 
                                html={mx.leadParagraph} onChange={h => patch({ leadParagraph: h })} 
                                className="pd text-2xl leading-relaxed italic border-l-4 pl-6" style={{ borderColor: mx.accent }} 
                            />
                            <EditZone 
                                html={mx.bodyParagraph} onChange={h => patch({ bodyParagraph: h })} 
                                className="ir text-lg leading-relaxed text-gray-800" 
                            />
                        </div>
                        {mx.showQuote && (
                            <div className="mt-auto pt-8 border-t border-gray-100 italic">
                                <EditZone html={mx.quote} onChange={h => patch({ quote: h })} className="ir text-sm font-bold text-black" />
                                <p className="sm text-[10px] uppercase tracking-widest mt-2 text-gray-400">{mx.quoteAuthor}</p>
                            </div>
                        )}
                    </div>
                );

            case 'GRANULAR':
                const g = activeState;
                return (
                    <div className={`w-full h-full flex flex-col p-14 relative transition-colors ${g.dark ? 'bg-black text-white' : 'bg-[#f4f4f4] text-black'}`}>
                        <div className="flex justify-between items-center mb-12">
                            <div className="ab text-3xl" style={{ color: g.accent }}>{g.brand}</div>
                            <div className="sm text-xs font-black p-2 border-2" style={{ borderColor: g.accent }}>{g.slideNum}</div>
                        </div>
                        <div className="sm text-[11px] font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                            <span className="w-8 h-[2px]" style={{ background: g.accent }}></span> {g.tag}
                        </div>
                        <EditZone 
                            html={g.headline} onChange={h => patch({ headline: h })} 
                            className="ab text-6xl leading-[0.9] mb-10 tracking-tighter uppercase" 
                        />
                        <div className="grid grid-cols-1 gap-8 flex-1">
                            <EditZone 
                                html={g.body} onChange={h => patch({ body: h })} 
                                className="ir text-2xl leading-snug font-medium" 
                            />
                            <EditZone 
                                html={g.bodyMono} onChange={h => patch({ bodyMono: h })} 
                                className="sm text-sm leading-relaxed opacity-70" 
                            />
                        </div>
                        <div className="mt-auto flex justify-between items-end pt-8 border-t border-black/10">
                            <div className="sm text-[10px] font-bold opacity-40">{g.footerHandle}</div>
                            <div className="pd text-lg italic max-w-[200px] text-right leading-tight">
                                <EditZone html={g.quote} onChange={h => patch({ quote: h })} />
                            </div>
                        </div>
                    </div>
                );

            case 'VIDEO_NOTE':
                const vn = activeState;
                const isYt = vn.videoUrl.includes('youtube') || vn.videoUrl.includes('youtu.be');
                return (
                    <div className="w-full h-full bg-black flex flex-col relative overflow-hidden">
                        {/* Hidden Static placeholder for preview only if needed */}
                        <div data-export="static" className="absolute inset-0 bg-zinc-900 flex items-center justify-center" style={{ display: 'none' }}>
                            <div className="ab text-4xl text-white opacity-20 uppercase tracking-tighter">PREVIEW STATIQUE</div>
                        </div>
                        
                        <div data-export="live" className="flex-1 relative bg-black overflow-hidden m-12 border-2 border-white/10">
                            {vn.videoUrl ? (
                                isYt ? (
                                    <iframe 
                                        className="w-full h-full pointer-events-none" 
                                        src={`https://www.youtube.com/embed/${vn.videoUrl.split('v=')[1]?.split('&')[0] || vn.videoUrl.split('/').pop()}?autoplay=1&mute=1&controls=0&loop=1`}
                                    />
                                ) : (
                                    <DraggableVideo 
                                        src={vn.videoUrl} zoom={vn.videoZoom || 1} 
                                        posX={vn.videoX || 0} posY={vn.videoY || 0} 
                                        onPosChange={(x,y) => patch({ videoX: x, videoY: y })} 
                                    />
                                )
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-zinc-700 sm text-[10px] uppercase font-bold tracking-widest">
                                    Aucune vidéo sélectionnée
                                </div>
                            )}
                            <div className="absolute inset-0 noise-overlay opacity-40"></div>
                        </div>

                        <div className="p-12 pt-0 z-20">
                            <div className="flex justify-between items-end gap-12">
                                <div className="flex-1">
                                    <div className="sm text-[10px] font-black text-white/40 uppercase tracking-widest mb-2 border-b border-white/10 pb-2 flex justify-between">
                                        <span>Dossier #042 — Radar L'Assez</span>
                                        <span style={{ color: vn.accent }}>DOCUMENT CLASSÉ</span>
                                    </div>
                                    <EditZone 
                                        html={vn.headline} onChange={h => patch({ headline: h })} 
                                        className="ab text-4xl text-white leading-tight uppercase tracking-tighter" 
                                    />
                                </div>
                                <div className="bg-white p-4 w-1/3 rotate-2 shadow-xl">
                                    <div className="sm text-[8px] font-black text-black/30 uppercase mb-1">NOTE INTERNE</div>
                                    <EditZone 
                                        html={vn.annotation} onChange={h => patch({ annotation: h })} 
                                        className="ir text-[11px] leading-tight text-black font-bold" 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                );
            
            case 'BIG_NUM':
                const bn = activeState;
                return (
                    <div className={`w-full h-full flex flex-col items-center justify-center p-20 text-center relative ${bn.dark ? 'bg-black text-white' : 'bg-white text-black'}`}>
                        <div className="absolute top-12 left-12 ab text-2xl" style={{ color: bn.accent }}>{bn.brand}</div>
                        <div className="space-y-4">
                            <EditZone html={bn.headline} onChange={h => patch({ headline: h })} className="sm text-xs font-black uppercase tracking-[0.4em] opacity-50" />
                            <EditZone html={bn.num} onChange={h => patch({ num: h })} className="ab text-[220px] leading-[0.8] tracking-tighter" style={{ color: bn.accent }} />
                            <div className="space-y-2 max-w-md mx-auto">
                                <EditZone html={bn.label} onChange={h => patch({ label: h })} className="ab text-4xl leading-tight uppercase" />
                                <EditZone html={bn.sub} onChange={h => patch({ sub: h })} className="ir text-lg leading-relaxed opacity-60" />
                            </div>
                        </div>
                    </div>
                );

            case 'OUTRO':
                const out = activeState;
                return (
                    <div className="w-full h-full bg-white flex flex-col p-12 relative overflow-hidden">
                        <div className="absolute inset-0 halftone opacity-10"></div>
                        <div className="flex-1 flex flex-col justify-center">
                            <EditZone 
                                html={out.headline} onChange={h => patch({ headline: h })} 
                                className="ab text-[180px] leading-[0.75] text-black tracking-tighter uppercase" 
                            />
                        </div>
                        <div className="flex justify-between items-end relative z-10">
                            <div className="space-y-4">
                                <div className="bg-black text-white p-6 inline-block rotate-[-2deg]">
                                    <EditZone html={out.brandHandle} onChange={h => patch({ brandHandle: h })} className="sm text-2xl font-black" />
                                </div>
                                <div className="sm text-xs font-bold uppercase tracking-widest text-gray-400">Suivez l'investigation brute.</div>
                            </div>
                            <div className="text-right space-y-2">
                                <div className="sm text-xs font-black uppercase px-3 py-1 border-2 inline-block" style={{ borderColor: out.accent, color: out.accent }}>{out.linkText}</div>
                                <div className="sm text-[10px] font-bold text-gray-300 uppercase tracking-tighter">{out.footerYear} — EDITION {out.number}</div>
                            </div>
                        </div>
                    </div>
                );

            default:
                return (
                    <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white sm uppercase text-xs">
                        Template {template} non implémenté visuellement
                    </div>
                );
        }
    };

    return (
        <div ref={exportRef} className="w-[1080px] h-[1350px] shrink-0 origin-top-left shadow-2xl bg-black overflow-hidden select-none" style={{ transform: 'scale(0.55)' }}>
            {renderTemplate()}
        </div>
    );
}
