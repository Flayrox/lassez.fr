import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Layout from '@/components/Layout';
import ElectionsClient from '@/components/ElectionsClient';
import type { Post } from '@/payload-types';
import type { Where } from 'payload';
import { getPayloadClient } from '@/lib/payload';
import Database from 'better-sqlite3';
import path from 'path';
import { formatElectionLabel } from '@/lib/elections';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
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

async function getElectionArticles(slug: string): Promise<Post[]> {
    try {
        const payload = await getPayloadClient();
        const keyword = slug.replace(/-/g, ' ').trim();

        const where: Where = {
            and: [
                { _status: { equals: 'published' } },
                {
                    or: [
                        { title: { contains: keyword } },
                        { excerpt: { contains: keyword } },
                        { slug: { contains: slug } },
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

async function getDepartments(electionSlug: string): Promise<string[]> {
    let db: any = null;
    try {
        const studioBase = getStudioBaseUrl();
        if (studioBase && !process.env.IS_STUDIO) {
            const res = await fetchWithTimeout(
                `${studioBase}/api/elections/results?slug=${encodeURIComponent(electionSlug)}&list_departments=1`,
                { cache: 'no-store' },
                1800
            );
            if (res.ok) {
                const data = await res.json();
                const departments = Array.isArray(data?.departments) ? data.departments.map((x: any) => String(x)).filter(Boolean) : [];
                if (departments.length) return departments;
            }
        }

        db = getDb();
        const rows = db.prepare(
            'SELECT DISTINCT code_departement FROM elections_officiel_cache WHERE election_slug = ? ORDER BY code_departement'
        ).all(electionSlug) as { code_departement: string }[];
        return rows.map(r => r.code_departement).filter(Boolean);
    } catch {
        return [];
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const resolvedParams = await params;
    const slug = String(resolvedParams.slug || '').trim();
    const electionName = formatElectionLabel(slug || 'elections');
    const baseUrl = 'https://lassez.fr';

    return {
        title: `${electionName} — Resultats en Direct | L'Assez`,
        description: `Suivez les resultats de ${electionName} en temps reel. Donnees officielles consolidees par la redaction de L'Assez.`,
        alternates: {
            canonical: `${baseUrl}/elections/${slug}`,
        },
        openGraph: {
            title: `${electionName} — Resultats en Direct | L'Assez`,
            description: `Resultats en temps reel de ${electionName}.`,
            type: 'article',
            images: [{ url: `${baseUrl}/android-chrome-512x512.png` }],
        },
    };
}

export const dynamic = 'force-dynamic';

export default async function ElectionsSlugPage({
    params,
    searchParams,
}: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ ville?: string; dep?: string }>;
}) {
    const resolvedParams = await params;
    const resolvedSearchParams = (await searchParams) || {};

    const slug = String(resolvedParams.slug || '').trim();
    if (!slug) {
        notFound();
    }

    const initialVille = String(resolvedSearchParams.ville || '').trim();
    const initialDep = String(resolvedSearchParams.dep || '').trim();

    const [articles, departments] = await Promise.all([
        getElectionArticles(slug),
        getDepartments(slug),
    ]);

    return (
        <Layout>
            <ElectionsClient
                electionSlug={slug}
                articles={articles}
                departments={departments}
                initialVille={initialVille}
                initialDep={initialDep}
            />
        </Layout>
    );
}
