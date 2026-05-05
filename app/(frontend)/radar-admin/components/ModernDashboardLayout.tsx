'use client';

import React, { Suspense } from 'react';
import { ModernSidebar } from '@/app/(frontend)/radar-admin/components/ModernSidebar';
import { ModernHeader } from '@/app/(frontend)/radar-admin/components/ModernHeader';

interface ModernDashboardLayoutProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    isDaemonRunning?: boolean;
    fullBleed?: boolean;
    embedded?: boolean;
    actions?: React.ReactNode;
}

export function ModernDashboardLayout({ 
    children, 
    title, 
    subtitle, 
    isDaemonRunning,
    fullBleed = false,
    embedded = false,
    actions
}: ModernDashboardLayoutProps) {
    if (embedded) {
        return (
            <div className="min-h-screen bg-white font-sans selection:bg-black selection:text-white text-slate-900">
                <main className="relative overflow-x-hidden">
                    <div className={`${fullBleed ? 'min-h-screen overflow-hidden' : 'p-4 md:p-6'} relative z-10`}>
                        {children}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-[#fafafa] font-sans selection:bg-black selection:text-white text-slate-900">
            <Suspense fallback={null}>
                <ModernSidebar />
            </Suspense>
            <main className="flex-1 relative overflow-x-hidden flex flex-col">
                <ModernHeader 
                    title={title} 
                    subtitle={subtitle} 
                    isDaemonRunning={isDaemonRunning} 
                    actions={actions}
                />
                <div className={`${fullBleed ? 'flex-1 overflow-hidden flex flex-col' : 'p-8 max-w-7xl w-full mx-auto'} relative z-10`}>
                    {children}
                </div>
            </main>
        </div>
    );
}
