import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Layout from '../../../components/Layout';
import ElectionsClient from '../../../components/ElectionsClient';
import { getServerWpApiBaseUrl } from '../../../lib/wp-server-base';
import { WPPost } from '../../../types';
import Database from 'better-sqlite3';
import path from 'path';
import { formatElectionLabel } from '../../../lib/elections';

const WP_BASE = getServerWpApiBaseUrl();

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

async function getElectionArticles(slug: string): Promise<WPPost[]> {
    try {
        const keyword = encodeURIComponent(slug.replace(/-/g, ' '));
        const res = await fetch(
            `${WP_BASE}/posts?search=${keyword}&per_page=6&_embed`,
            { next: { revalidate: 300 } }
        );
        if (!res.ok) return [];
        return res.json();
    } catch {
        return [];
    }
}

async function getDepartments(electionSlug: string): Promise<string[]> {
    let db: any = null;
    try {
        const studioBase = getStudioBaseUrl();
        if (studioBase && !process.env.IS_STUDIO) {
            const res = await fetch(`${studioBase}/api/elections/results?slug=${encodeURIComponent(electionSlug)}&list_departments=1`, { cache: 'no-store' });
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

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
    const slug = String(params.slug || '').trim();
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
    params: { slug: string };
    searchParams?: { ville?: string; dep?: string };
}) {
    const slug = String(params.slug || '').trim();
    if (!slug) {
        notFound();
    }

    const initialVille = String(searchParams?.ville || '').trim();
    const initialDep = String(searchParams?.dep || '').trim();

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
