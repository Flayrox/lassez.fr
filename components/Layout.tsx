'use client';

import React, { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

import { usePathname } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isFocusMode = pathname === '/comprendre';

  if (isFocusMode) {
    return (
      <div className="flex flex-col min-h-screen bg-black">
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <Header onMenuClick={() => setIsSidebarOpen(true)} />

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

      <Footer />
    </div>
  );
};

export default Layout;
