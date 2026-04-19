import { Metadata } from 'next';
import Layout from '@/components/Layout';
import InvestigationGraphClient from '@/components/InvestigationGraphClient';

export const metadata: Metadata = {
    title: "Investigation Mode | L'Assez",
    description: "Explorez les connexions entre nos enquêtes.",
};

export default function InvestigationPage() {
    return (
        <Layout>
            <div className="min-h-screen bg-paper text-ink">
                <div className="container mx-auto px-4 py-8">
                    <header className="mb-8 flex flex-col md:flex-row justify-between items-end gap-4 border-b-4 border-black pb-4">
                        <div>
                            <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-2">
                                Mode <span className="text-lassez-red">Investigation</span>
                            </h1>
                            <p className="font-mono text-sm uppercase tracking-widest opacity-60">
                                Matrice des connexions
                            </p>
                        </div>
                        <div className="text-right hidden md:block">
                            <div className="inline-block bg-black text-white px-3 py-1 font-mono text-xs mb-1">
                                ACCÈS AUTORISÉ
                            </div>
                            <div className="text-xs font-mono opacity-50">
                                v.2.0.4 stable
                            </div>
                        </div>
                    </header>

                    <InvestigationGraphClient />
                </div>
            </div>
        </Layout>
    );
}
