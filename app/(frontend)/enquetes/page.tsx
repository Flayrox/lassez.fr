import React from 'react';
import { Metadata } from 'next';
import EnquetesClient from '@/components/EnquetesClient';
import Layout from '@/components/Layout';

export const metadata: Metadata = {
    title: "Enquêtes | L'Assez",
    description: "Accédez aux enquêtes, dossiers et archives publiés par L'Assez.",
    alternates: {
        canonical: 'https://lassez.fr/enquetes',
    },
};

export default function EnquetesPage() {
    return (
        <Layout>
            <React.Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center font-mono text-ink">CHARGEMENT DES ARCHIVES...</div>}>
                <EnquetesClient />
            </React.Suspense>
        </Layout>
    );
}
