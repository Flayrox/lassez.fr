'use client';

import React, { Suspense } from 'react';
import { BrutalSidebar } from './BrutalSidebar';
import { BrutalHeader } from './BrutalHeader';

interface DashboardLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    isDaemonRunning?: boolean;
    fullBleed?: boolean;
    embedded?: boolean;
}

export function DashboardLayout({ 
    children, 
    title, 
    subtitle, 
    isDaemonRunning,
    fullBleed = false,
    embedded = false
}: DashboardLayoutProps) {
    if (embedded) {
        return (
            <div className="min-h-screen bg-stone-50 font-body selection:bg-red-700 selection:text-white">
                <main className="relative overflow-x-hidden">
                    <div className="grain-overlay absolute inset-0 z-0 opacity-5 pointer-events-none"></div>
                    <div className={`${fullBleed ? 'min-h-screen overflow-hidden' : 'p-4 md:p-6'} relative z-10`}>
                        {children}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-stone-50 font-body selection:bg-red-700 selection:text-white">
            <Suspense fallback={null}>
                <BrutalSidebar />
            </Suspense>
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
