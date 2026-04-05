import React from 'react';
import { Metadata } from 'next';
import EnquetesClient from '../../components/EnquetesClient';
import Layout from '../../components/Layout';

export const metadata: Metadata = {
    title: "Les Dossiers | L'Assez",
    description: "Accédez à l'intégralité de nos enquêtes et archives classifiées.",
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
