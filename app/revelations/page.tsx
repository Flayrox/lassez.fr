import { Metadata } from 'next';
import React, { Suspense } from 'react';
import RevelationsClient from '../../components/RevelationsClient';
import Layout from '../../components/Layout';

export const metadata: Metadata = {
    title: "Flux Live | L'Assez",
    description: "Fil d'actualité en temps réel. Informations brutes.",
};

export default function RevelationsPage() {
    return (
        <Layout>
            <Suspense fallback={<div className="flex justify-center py-20 animate-pulse">Chargement du flux...</div>}>
                <RevelationsClient />
            </Suspense>
        </Layout>
    );
}
