'use client';

import React, { Suspense } from 'react';
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
        <div className="h-screen bg-white font-sans selection:bg-black selection:text-white text-slate-900 flex flex-col overflow-hidden">
            <ModernHeader 
                title={title} 
                subtitle={subtitle} 
                isDaemonRunning={isDaemonRunning} 
                actions={actions}
            />
            {/* The main container MUST be flex-1 and h-full to allow canvas stretching */}
            <main className="flex-1 relative flex flex-col overflow-hidden">
                <div className={`${fullBleed ? 'flex-1 h-full overflow-hidden flex flex-col' : 'p-10 max-w-[1600px] w-full mx-auto overflow-y-auto'} relative z-10 h-full`}>
                    {children}
                </div>
            </main>
        </div>
    );
}
