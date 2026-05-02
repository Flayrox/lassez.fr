'use client';

import React, { useEffect } from 'react';
import Sidebar from './Sidebar';
import { usePathname } from 'next/navigation';
import { useUI } from './UIProvider';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isSidebarOpen, setIsSidebarOpen, setHeaderVisible, setFooterVisible } = useUI();
  const pathname = usePathname();
  const isFocusMode = pathname === '/comprendre' || pathname?.startsWith('/preview');

  useEffect(() => {
    if (isFocusMode) {
      setHeaderVisible(false);
      setFooterVisible(false);
    } else {
      setHeaderVisible(true);
      setFooterVisible(true);
    }
  }, [isFocusMode, setHeaderVisible, setFooterVisible]);

  if (isFocusMode) {
    return (
      <div className="flex flex-col min-h-screen bg-black">
        {children}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 flex flex-1 relative gap-6 lg:gap-8 pt-[190px] md:pt-[240px]">
      <React.Suspense fallback={<div className="w-[320px] shrink-0 hidden lg:block border-r-4 border-lassez-border bg-paper opacity-50" />}>
        <Sidebar
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
          hideOnDesktop={pathname === '/'}
        />
      </React.Suspense>
      <main className="flex-1 min-w-0 pb-12">
        {children}
      </main>
    </div>
  );
};

export default Layout;
