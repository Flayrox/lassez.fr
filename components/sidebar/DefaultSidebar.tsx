'use client';

import React from 'react';

interface DefaultSidebarProps {
    onClose: () => void;
}

const DefaultSidebar: React.FC<DefaultSidebarProps> = ({ onClose }) => {
    return (
        <>
            <div className="hidden lg:flex p-6 border-b-4 border-ink bg-ink/5 items-center justify-between">
                <h2 className="font-black uppercase text-xl tracking-tighter text-ink">Menu</h2>
                <div className="w-3 h-3 bg-lassez-red rounded-full animate-pulse"></div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <p className="text-sm font-mono text-ink/60 italic">Sélectionnez une section pour explorer nos archives.</p>
            </div>
        </>
    );
};

export default DefaultSidebar;
