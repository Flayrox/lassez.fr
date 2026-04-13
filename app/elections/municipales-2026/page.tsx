import { Metadata } from 'next';
import Layout from '../../../components/Layout';
import ElectionsClient from '../../../components/ElectionsClient';
import { WP_API_URL } from '../../../lib/api';
import { WPPost } from '../../../types';
import Script from 'next/script';
import Database from 'better-sqlite3';
import path from 'path';

const ELECTION_SLUG = 'municipales-2026';
const BASE_URL = 'https://lassez.fr';

export const metadata: Metadata = {
    title: "Élections Municipales 2026 — Résultats en Direct | L'Assez",
    description: "Suivez les résultats des élections municipales 2026 en temps réel. Résultats ville par ville, analyses et décryptages par la rédaction de L'Assez.",
    openGraph: {
        title: "Élections Municipales 2026 — Résultats en Direct | L'Assez",
        description: "Résultats en temps réel des élections municipales 2026. Ville par ville, données officielles consolidées.",
        type: 'article',
        images: [{ url: `${BASE_URL}/android-chrome-512x512.png` }],
    },
    alternates: {
        canonical: `${BASE_URL}/elections/municipales-2026`,
    },
};

async function getElectionArticles(): Promise<WPPost[]> {
    try {
        // Cherche d'abord les articles avec le tag ou la catégorie "elections"
        // L'API WP permet de chercher par slug de catégorie
        const res = await fetch(
            `${WP_API_URL}/posts?search=élections+municipales&per_page=6&_embed`,
            { next: { revalidate: 300 } }
        );
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

async function getDepartments(): Promise<string[]> {
    try {
        const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
        const db = new Database(dbPath);
        const rows = db.prepare('SELECT DISTINCT code_departement FROM elections_officiel_cache ORDER BY code_departement').all() as { code_departement: string }[];
        db.close();
        return rows.map(r => r.code_departement).filter(Boolean);
    } catch (error) {
        console.error('Error fetching departments:', error);
        return [];
    }
}

export default async function ElectionsMunicipales2026({
    searchParams,
}: {
    searchParams?: { ville?: string; dep?: string };
}) {
    const [articles, departments] = await Promise.all([
        getElectionArticles(),
        getDepartments()
    ]);

    const initialVille = String(searchParams?.ville || '').trim();
    const initialDep = String(searchParams?.dep || '').trim();

    const liveBlogSchema = {
        "@context": "https://schema.org",
        "@type": "LiveBlogPosting",
        "headline": "Élections Municipales 2026 — Résultats en direct",
        "description": "Suivez les résultats des élections municipales 2026 en temps réel, ville par ville.",
        "url": `${BASE_URL}/elections/municipales-2026`,
        "coverageStartTime": "2026-03-22T20:00:00+01:00",
        "coverageEndTime": "2026-03-23T02:00:00+01:00",
        "liveBlogUpdate": [],
        "publisher": {
            "@type": "Organization",
            "name": "L'Assez",
            "url": BASE_URL,
            "logo": {
                "@type": "ImageObject",
                "url": `${BASE_URL}/android-chrome-512x512.png`
            }
        },
        "author": {
            "@type": "Organization",
            "name": "Rédaction L'Assez",
            "url": `${BASE_URL}/apropos`
        }
    };

    const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": BASE_URL },
            { "@type": "ListItem", "position": 2, "name": "Élections", "item": `${BASE_URL}/elections` },
            { "@type": "ListItem", "position": 3, "name": "Municipales 2026", "item": `${BASE_URL}/elections/municipales-2026` },
        ]
    };

    return (
        <Layout>
            <Script id="json-ld-liveblog" type="application/ld+json" strategy="beforeInteractive">
                {JSON.stringify(liveBlogSchema)}
            </Script>
            <Script id="json-ld-breadcrumb-elections" type="application/ld+json" strategy="beforeInteractive">
                {JSON.stringify(breadcrumbSchema)}
            </Script>
            <ElectionsClient
                electionSlug={ELECTION_SLUG}
                articles={articles}
                departments={departments}
                initialVille={initialVille}
                initialDep={initialDep}
            />
        </Layout>
    );
}
