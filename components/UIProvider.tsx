'use client';

import React, { createContext, useContext, useState } from 'react';

interface UIContextType {
    isSidebarOpen: boolean;
    setIsSidebarOpen: (open: boolean) => void;
    headerVisible: boolean;
    setHeaderVisible: (visible: boolean) => void;
    footerVisible: boolean;
    setFooterVisible: (visible: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [footerVisible, setFooterVisible] = useState(true);

    return (
        <UIContext.Provider value={{ 
            isSidebarOpen, setIsSidebarOpen, 
            headerVisible, setHeaderVisible, 
            footerVisible, setFooterVisible 
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) {
        throw new Error('useUI must be used within a UIProvider');
    }
    return context;
};
