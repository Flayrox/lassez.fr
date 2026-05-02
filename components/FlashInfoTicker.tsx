'use client';

import React from 'react';
import { useSettings } from './SettingsProvider';

export const FlashInfoTicker: React.FC = () => {
    const settings = useSettings();
    
    if (settings.displaySettings?.flashInfoEnabled === false) {
        return null;
    }

    const activeItems = (settings.tickerItems || [])
        .filter((item: any) => item.active)
        .map((item: any) => item.text);

    let displayContent = "";
    
    if (activeItems.length > 0) {
        displayContent = activeItems.join(" +++ ");
    } else {
        displayContent = settings.flashInfoText || "L'INVESTIGATION NE S'ARRÊTE JAMAIS +++ SOURCE CONFIDENTIELLE CONFIRMÉE";
    }

    return (
        <div className="bg-ink text-paper py-2.5 border-y-4 border-lassez-red overflow-hidden relative group w-full shadow-hard-sm">
            <div className="flex whitespace-nowrap animate-[marquee_40s_linear_infinite] hover:[animation-play-state:paused]">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-6 md:gap-8 px-4">
                        <span className="font-mono font-black text-lassez-red text-[10px] md:text-xs shrink-0">FLASH INFO :</span>
                        <span className="font-mono text-[10px] md:text-xs uppercase tracking-widest">+++ {displayContent.toUpperCase()} +++</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
