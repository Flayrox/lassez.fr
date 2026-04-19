import React from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { Metadata } from 'next';

export const metadata: Metadata = {
    title: "Page introuvable | L'Assez",
    description: "Le dossier que vous cherchez a été classifié ou n'existe plus.",
};

export default function NotFound() {
    return (
        <Layout>
            <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center mt-12 bg-paper-bright border-4 border-lassez-border p-8 shadow-hard">
                <div className="w-16 h-16 bg-ink text-paper rounded-full flex items-center justify-center mb-6 shadow-hard-sm">
                    <span className="font-mono font-black text-xs">x_x</span>
                </div>
                <h2 className="text-8xl md:text-9xl font-black text-lassez-red mb-2 tracking-tighter">404</h2>
                <h3 className="text-2xl md:text-3xl font-bold font-serif text-ink mb-6 uppercase tracking-tight">DOSSIER CLASSIFIÉ OU INTRoUVABLE</h3>

                <p className="text-ink/80 max-w-md mx-auto mb-10 font-mono text-sm leading-relaxed border-l-4 border-lassez-red pl-4 text-left">
                    L'URL demandée n'existe pas ou l'article a été retiré de nos bases de données. Vous essayez d'accéder à un secteur restreint ou l'information a été modifiée. L'investigation se poursuit.
                </p>

                <Link href="/" className="group flex items-center gap-2 bg-ink text-paper px-8 py-4 font-black uppercase tracking-widest text-xs hover:bg-lassez-red hover:text-ink transition-all shadow-hard-sm active:scale-95">
                    <span>RETOURNER AU POSTE DE COMMANDEMENT</span>
                </Link>
            </div>
        </Layout>
    );
}
