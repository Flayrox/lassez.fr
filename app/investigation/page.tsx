import { Metadata } from 'next';
import dynamic from 'next/dynamic';
import Layout from '../../components/Layout';

const DynamicInvestigationGraph = dynamic(() => import('../../components/InvestigationGraph'), {
    ssr: false,
    loading: () => (
        <div className="h-[600px] flex items-center justify-center bg-gray-50 border-4 border-dashed border-gray-200">
            <div className="text-center font-mono">
                <div className="w-12 h-12 border-4 border-black border-t-lassez-red rounded-full animate-spin mx-auto mb-4"></div>
                <p className="uppercase font-bold tracking-widest text-sm">Chargement de la matrice...</p>
            </div>
        </div>
    )
});

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

                    <DynamicInvestigationGraph />
                </div>
            </div>
        </Layout>
    );
}
