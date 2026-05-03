'use client';

import React from 'react';
import { useStudio } from './StudioContext';
import { EditZone } from './EditZone';
import { DraggableImage, DraggableVideo } from './DraggableMedia';
import { getTemplate } from '../registry';

export function StudioCanvas({ exportRef }: { exportRef: React.RefObject<HTMLDivElement | null> }) {
    const { activeSlide, patchActive } = useStudio();
    
    if (!activeSlide) return null;

    const { type: template, state: activeState } = activeSlide;

    // Helper for patching state
    const patch = (p: any) => patchActive(p);

    // Template-specific renders (extracted from page.tsx)
    const renderTemplate = () => {
        // RÉCUPÉRER LE TEMPLATE DEPUIS LE NOUVEAU REGISTRE (ELITE ARCHITECTURE)
        const modularTemplate = getTemplate(template);
        if (modularTemplate) {
            const TemplateComponent = modularTemplate.Component;
            return <TemplateComponent state={activeState} patch={patch} />;
        }

        return (
            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-white sm uppercase text-xs">
                Template {template} non implémenté visuellement
            </div>
        );
    };

    return (
        <div className="flex items-center justify-center p-10 min-h-full">
            <div className="shrink-0 transition-all duration-300">
                <div 
                    ref={exportRef} 
                    className="w-[560px] h-[700px] bg-black overflow-hidden select-none relative"
                >
                    {renderTemplate()}
                </div>
            </div>
        </div>
    );
}
