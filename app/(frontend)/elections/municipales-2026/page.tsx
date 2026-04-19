import { Metadata } from 'next';
import Layout from '@/components/Layout';
import ElectionsClient from '@/components/ElectionsClient';
import type { Post } from '@/payload-types';
import type { Where } from 'payload';
import { getPayloadClient } from '@/lib/payload';
import Script from 'next/script';
import Database from 'better-sqlite3';
import path from 'path';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

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

async function getElectionArticles(): Promise<Post[]> {
    try {
        const payload = await getPayloadClient();

        const where: Where = {
            and: [
                { _status: { equals: 'published' } },
                {
                    or: [
                        { title: { contains: 'municipales' } },
                        { excerpt: { contains: 'municipales' } },
                        { slug: { contains: ELECTION_SLUG } },
                    ],
                },
            ],
        };

        const result = await payload.find({
            collection: 'posts',
            where,
            limit: 6,
            depth: 1,
            sort: '-publishedAt',
        });

        return result.docs as Post[];
    } catch {
        return [];
    }
}

function getStudioBaseUrl() {
    const remoteUrl = process.env.RADAR_API_URL;
    if (!remoteUrl) return null;
    try {
        const u = new URL(remoteUrl);
        return `${u.protocol}//${u.host}`;
    } catch {
        return null;
    }
}

async function getDepartments(): Promise<string[]> {
    let db: any = null;
    try {
        const studioBase = getStudioBaseUrl();
        if (studioBase && !process.env.IS_STUDIO) {
            const res = await fetchWithTimeout(
                `${studioBase}/api/elections/results?slug=${encodeURIComponent(ELECTION_SLUG)}&list_departments=1`,
                { cache: 'no-store' },
                1800
            );
            if (res.ok) {
                const data = await res.json();
                const departments = Array.isArray(data?.departments)
                    ? data.departments.map((x: any) => String(x)).filter(Boolean)
                    : [];
                if (departments.length) return departments;
            }
        }

        const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
        db = new Database(dbPath);

        const tableExists = db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='elections_officiel_cache'"
        ).get();
        if (!tableExists) return [];

        const rows = db.prepare('SELECT DISTINCT code_departement FROM elections_officiel_cache ORDER BY code_departement').all() as { code_departement: string }[];
        return rows.map(r => r.code_departement).filter(Boolean);
    } catch (_) {
        return [];
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}

export default async function ElectionsMunicipales2026({
    searchParams,
}: {
    searchParams?: Promise<{ ville?: string; dep?: string }>;
}) {
    const [articles, departments] = await Promise.all([
        getElectionArticles(),
        getDepartments()
    ]);

    const resolvedSearchParams = (await searchParams) || {};
    const initialVille = String(resolvedSearchParams.ville || '').trim();
    const initialDep = String(resolvedSearchParams.dep || '').trim();

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
            <script
                id="json-ld-liveblog"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(liveBlogSchema) }}
            />
            <script
                id="json-ld-breadcrumb-elections"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
            />
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
