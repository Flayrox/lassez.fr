"use client";

import dynamic from 'next/dynamic';

const DynamicInvestigationGraph = dynamic(() => import('./InvestigationGraph'), {
    ssr: false,
    loading: () => (
        <div className="h-[600px] flex items-center justify-center bg-gray-50 border-4 border-dashed border-gray-200">
            <div className="text-center font-mono">
                <div className="w-12 h-12 border-4 border-black border-t-lassez-red rounded-full animate-spin mx-auto mb-4"></div>
                <p className="uppercase font-bold tracking-widest text-sm">Chargement de la matrice...</p>
            </div>
        </div>
    ),
});

export default function InvestigationGraphClient() {
    return <DynamicInvestigationGraph />;
}