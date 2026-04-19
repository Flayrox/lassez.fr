import { Metadata } from 'next';
import React, { Suspense } from 'react';
import RevelationsClient from '@/components/RevelationsClient';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
    title: "Flux Révélations | L'Assez",
    description: "Fil d'actualité en temps réel. Informations brutes, sources protégées.",
};

export default function RevelationsPage() {
    return (
        <Layout>
            <Suspense fallback={
                <div className="flex justify-center py-20 font-mono text-ink/40 animate-pulse uppercase text-sm">
                    Connexion au flux...
                </div>
            }>
                <RevelationsClient />
            </Suspense>
        </Layout>
    );
}

