'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface UIContextType {
    isTerminalOpen: boolean;
    setTerminalOpen: (open: boolean) => void;
    selectedNodeId: string | null;
    setSelectedNodeId: (id: string | null) => void;
    terminalPosition: { x: number; y: number };
    setTerminalPosition: (pos: { x: number; y: number }) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: React.ReactNode }) {
    const [isTerminalOpen, setTerminalOpen] = useState(false);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [terminalPosition, setTerminalPosition] = useState({ x: 0, y: 0 });

    return (
        <UIContext.Provider value={{ 
            isTerminalOpen, 
            setTerminalOpen, 
            selectedNodeId, 
            setSelectedNodeId,
            terminalPosition, 
            setTerminalPosition 
        }}>
            {children}
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
}
