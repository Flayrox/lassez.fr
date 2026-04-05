'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { NavItem } from '@/types';

interface NavContextType {
  navItems: NavItem[];
}

const NavContext = createContext<NavContextType | undefined>(undefined);

export function NavProvider({
  children,
  initialNavItems,
}: {
  children: ReactNode;
  initialNavItems: NavItem[];
}) {
  return (
    <NavContext.Provider value={{ navItems: initialNavItems }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const context = useContext(NavContext);
  if (context === undefined) {
    throw new Error('useNav must be used within a NavProvider');
  }
  return context;
}
