import React from 'react';
import { StudioTemplate } from '../core/types';
import { EditZone } from '../components/EditZone';

export const ChecklistTemplate: StudioTemplate = {
    id: 'CHECKLIST',
    name: 'Checklist Action',
    category: 'Guide',
    description: 'Une liste à cocher pour engager l\'utilisateur dans une action.',
    
    defaultState: {
        headline: "COMMENT AGIR ?",
        item1: "Désamorcer le récit officiel",
        item2: "Soutenir les médias indépendants",
        item3: "Rejoindre un collectif local",
        item4: "Partager l'information",
        check1: true,
        check2: false,
        check3: false,
        check4: false,
        brand: "L'ASSEZ",
        accent: "#DC2626"
    },
    
    schema: [
        { key: 'accent', label: 'Couleur Accent', type: 'color', group: 'Style' },
        { key: 'headline', label: 'Titre Principal', type: 'text', group: 'Contenu' },
        { key: 'item1', label: 'Action 1', type: 'text', group: 'Actions' },
        { key: 'check1', label: 'Check 1', type: 'boolean', group: 'Actions' },
        { key: 'item2', label: 'Action 2', type: 'text', group: 'Actions' },
        { key: 'check2', label: 'Check 2', type: 'boolean', group: 'Actions' },
        { key: 'item3', label: 'Action 3', type: 'text', group: 'Actions' },
        { key: 'check3', label: 'Check 3', type: 'boolean', group: 'Actions' },
        { key: 'item4', label: 'Action 4', type: 'text', group: 'Actions' },
        { key: 'check4', label: 'Check 4', type: 'boolean', group: 'Actions' },
    ],
    
    shadowStyle: (state) => ({
        boxShadow: `inset 0 0 100px rgba(0,0,0,0.05), 10px 10px 0 ${state.accent}22`
    }),
    
    Component: ({ state, patch }) => {
        return (
            <div className="w-full h-full bg-white overflow-hidden border-4 border-black flex flex-col p-8 relative">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000)', backgroundSize: '40px 40px', backgroundPosition: '0 0, 20px 20px' }}></div>
                
                <header className="relative z-10 mb-8 border-l-[10px] border-black pl-5">
                    <EditZone html={state.headline} onChange={h => patch({ headline: h })} label="TITRE" stickerPos="-top-5 right-0"
                        className="pd font-black text-5xl leading-none uppercase tracking-tighter" />
                    <span className="sm text-[10px] uppercase font-bold text-gray-400 mt-2 block tracking-widest">{state.brand} / PROTOCOLE D'ACTION</span>
                </header>
                
                <main className="relative z-10 flex-grow space-y-5 flex flex-col justify-center">
                    {[1, 2, 3, 4].map(num => (
                        <div key={num} className="flex gap-4 items-center group">
                            <div className="w-10 h-10 border-4 border-black flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                                onClick={() => patch({ [`check${num}`]: !state[`check${num}`] })}
                                style={{ backgroundColor: state[`check${num}`] ? state.accent : 'transparent' }}>
                                {state[`check${num}`] && <div className="w-5 h-5 bg-white"></div>}
                            </div>
                            <div className="flex-1 relative">
                                <EditZone html={state[`item${num}`]} onChange={h => patch({ [`item${num}`]: h })} label={`ITEM ${num}`} stickerPos="top-0 right-0"
                                    className={`ab text-2xl uppercase transition-all ${state[`check${num}`] ? 'line-through opacity-50' : ''}`} />
                            </div>
                        </div>
                    ))}
                </main>
                
                <footer className="relative z-10 mt-8 pt-5 border-t-2 border-black/10 flex justify-between items-end">
                    <div className="flex -space-x-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-black" style={{ backgroundColor: i === 0 ? state.accent : '#eee' }}></div>
                        ))}
                    </div>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="3"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                </footer>
                
                <div className="absolute top-10 right-10 w-20 h-20 opacity-10 pointer-events-none select-none">
                    <svg viewBox="0 0 24 24" fill="black"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                </div>
            </div>
        );
    }
};
