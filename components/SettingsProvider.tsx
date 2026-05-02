'use client';

import React, { createContext, useContext } from 'react';
import { Setting } from '@/payload-types';

const SettingsContext = createContext<Setting | null>(null);

export const SettingsProvider: React.FC<{ settings: Setting; children: React.ReactNode }> = ({ settings, children }) => {
    return (
        <SettingsContext.Provider value={settings}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
};
