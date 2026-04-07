'use client';

import React from 'react';
import { BrutalSidebar } from './BrutalSidebar';
import { BrutalHeader } from './BrutalHeader';

interface DashboardLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    isDaemonRunning?: boolean;
    fullBleed?: boolean;
}

export function DashboardLayout({ 
    children, 
    title, 
    subtitle, 
    isDaemonRunning,
    fullBleed = false
}: DashboardLayoutProps) {
    return (
        <div className="flex min-h-screen bg-stone-50 font-body selection:bg-red-700 selection:text-white">
            <BrutalSidebar />
            <main className="flex-1 relative overflow-x-hidden flex flex-col">
                <div className="grain-overlay absolute inset-0 z-0 opacity-5 pointer-events-none"></div>
                <BrutalHeader 
                    title={title} 
                    subtitle={subtitle} 
                    isDaemonRunning={isDaemonRunning} 
                />
                <div className={`${fullBleed ? 'flex-1 overflow-hidden' : 'p-8'} relative z-10`}>
                    {children}
                </div>
            </main>
        </div>
    );
}
