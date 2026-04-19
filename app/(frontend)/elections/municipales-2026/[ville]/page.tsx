import React from 'react';
import Layout from '@/components/Layout';
import ElectionResultsLive from '@/components/ElectionResultsLive';
import { Metadata } from 'next';
import Script from 'next/script';

// On normalise le slug pour l'affichage propre dans le titre
function formatVille(slug: string) {
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export async function generateMetadata({ params }: { params: Promise<{ ville: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const villeName = formatVille(resolvedParams.ville);
    const title = `Résultats Élections Municipales 2026 à ${villeName} (1er & 2nd tour) — Le Radar`;
    const description = `Consultez les résultats officiels des élections municipales 2026 à ${villeName}. Scores des candidats, nuances politiques (NFP, RN, ENS, LR) et taux de participation en direct du Ministère de l'Intérieur.`;
    
    return {
        title,
        description,
        alternates: {
            canonical: `https://lassez.fr/elections/municipales-2026/${resolvedParams.ville}`,
        },
        openGraph: {
            title,
            description,
            type: 'article',
            url: `https://lassez.fr/elections/municipales-2026/${resolvedParams.ville}`,
            images: [
                {
                    url: '/images/og-elections.png',
                    width: 1200,
                    height: 630,
                    alt: `Résultats Municipales 2026 - ${villeName}`,
                }
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
        }
    };
}

export default async function VilleElectionPage({ 
    params, 
    searchParams 
}: { 
    params: Promise<{ ville: string }>,
    searchParams?: Promise<{ dep?: string }>
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = (await searchParams) || {};

    const villeDisplay = formatVille(resolvedParams.ville);
    const initialDep = resolvedSearchParams.dep || '';

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": "https://lassez.fr" },
            { "@type": "ListItem", "position": 2, "name": "Élections", "item": "https://lassez.fr/elections/municipales-2026" },
            { "@type": "ListItem", "position": 3, "name": villeDisplay, "item": `https://lassez.fr/elections/municipales-2026/${resolvedParams.ville}` },
        ]
    };

    return (
        <Layout>
            <Script id={`json-ld-breadcrumb-${resolvedParams.ville}`} type="application/ld+json" strategy="afterInteractive">
                {JSON.stringify(breadcrumbSchema)}
            </Script>
            <main className="max-w-7xl mx-auto px-4 py-12">
                <div className="mb-12">
                    <div className="inline-block bg-lassez-red text-paper px-4 py-1 font-mono text-xs font-black uppercase mb-4 shadow-hard">
                        Silo Électoral — {villeDisplay} {initialDep ? `(${initialDep})` : ''}
                    </div>
                    <h1 className="font-serif font-black text-5xl md:text-7xl uppercase tracking-tighter text-ink leading-[0.9] mb-6">
                        Municipales <span className="text-lassez-red">2026</span> :<br />
                        Les résultats à {villeDisplay}
                    </h1>
                    <p className="font-serif text-xl text-ink/60 max-w-2xl">
                        Scores détaillés, têtes de liste et nuances politiques. Les données sont rafraîchies en temps réel dès publication par le Ministère de l'Intérieur.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* Colonne principale : Les résultats de la ville */}
                    <div className="lg:col-span-2">
                        <ElectionResultsLive 
                            electionSlug="municipales-2026" 
                            initialVille={villeDisplay} 
                            initialDep={initialDep}
                        />
                    </div>

                    {/* Sidebar contextuelle */}
                    <div className="space-y-8">
                        <div className="bg-paper border-2 border-ink p-6 shadow-hard">
                            <h2 className="font-serif font-black uppercase text-xl mb-4 border-b-2 border-ink pb-2">
                                Méthodologie
                            </h2>
                            <p className="font-mono text-[11px] leading-relaxed text-ink/70 uppercase">
                                LES DONNÉES AFFICHÉES SONT ISSUES DU FLUX OFFICIEL DE L'ÉTAT (DATA.GOUV.FR). EN CAS DE DÉCALAGE, LE RADAR-ADMIN PERMET DES UPDATES EN TEMPS RÉEL PAR NOS ÉQUIPES TERRAIN.
                            </p>
                        </div>

                        <div className="bg-ink text-paper p-6 shadow-hard">
                            <h2 className="font-serif font-black uppercase text-xl mb-4 border-b-2 border-paper/20 pb-2">
                                Autres Villes
                            </h2>
                            <ul className="space-y-3">
                                {['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Bordeaux'].map(city => (
                                    <li key={city}>
                                        <a 
                                            href={`/elections/municipales-2026/${city.toLowerCase()}`}
                                            className="font-mono text-xs font-black uppercase tracking-widest hover:text-lassez-red transition-colors block"
                                        >
                                            → {city}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </main>
        </Layout>
    );
}
