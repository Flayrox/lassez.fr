import { Metadata } from 'next';
import Layout from '@/components/Layout';
import Database from 'better-sqlite3';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ElectionResultsLive from '@/components/ElectionResultsLive';
import CitySearchBar from '@/components/CitySearchBar';
import { getDepartmentName } from '@/lib/geo-data';
import { formatElectionLabel } from '@/lib/elections';

interface PageProps {
    params: {
        slug: string;
        communeSlug: string;
    };
}

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath, { readonly: true });
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

async function getCityByInsee(electionSlug: string, codeInsee: string) {
    let db: any = null;
    try {
        const studioBase = getStudioBaseUrl();
        if (studioBase && !process.env.IS_STUDIO) {
            const res = await fetch(
                `${studioBase}/api/elections/results?slug=${encodeURIComponent(electionSlug)}&city_by_insee=1&insee=${encodeURIComponent(codeInsee)}`,
                { cache: 'no-store' }
            );
            if (res.ok) {
                const data = await res.json();
                if (data?.city) return data.city as { code_insee: string; ville: string; code_departement: string };
            }
        }

        db = getDb();
        const row = db.prepare(
            'SELECT code_insee, ville, code_departement FROM elections_officiel_cache WHERE election_slug = ? AND code_insee = ? LIMIT 1'
        ).get(electionSlug, codeInsee) as { code_insee: string; ville: string; code_departement: string } | undefined;
        return row || null;
    } catch {
        return null;
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const electionSlug = String(params.slug || '').trim();
    const codeInsee = String(params.communeSlug || '').split('-')[0];
    const electionName = formatElectionLabel(electionSlug || 'elections');

    const city = await getCityByInsee(electionSlug, codeInsee);
    if (!city) {
        return { title: `Resultats ${electionName} — Commune introuvable` };
    }

    return {
        title: `Resultats ${electionName} a ${city.ville} (${city.code_insee}) — L'Assez`,
        description: `Consultez les resultats de ${electionName} pour ${city.ville}.`,
        alternates: {
            canonical: `https://lassez.fr/elections/${electionSlug}/commune/${params.communeSlug}`,
        },
    };
}

export default async function CommuneSlugPage({ params }: PageProps) {
    const electionSlug = String(params.slug || '').trim();
    const codeInsee = String(params.communeSlug || '').split('-')[0];
    if (!electionSlug || !codeInsee) {
        notFound();
    }

    const city = await getCityByInsee(electionSlug, codeInsee);
    if (!city) {
        notFound();
    }

    const deptName = getDepartmentName(city.code_departement) || `Departement ${city.code_departement}`;
    const electionName = formatElectionLabel(electionSlug);

    return (
        <Layout>
            <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8">
                <CitySearchBar electionSlug={electionSlug} />

                <div className="border-b-4 border-ink pb-4">
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            href={`/elections/${electionSlug}/departement/${city.code_departement}`}
                            className="font-mono text-[9px] font-black uppercase tracking-widest text-lassez-red hover:underline"
                        >
                            Retour departement
                        </Link>
                        <span className="font-mono text-[9px] text-ink/40 uppercase tracking-widest">
                            {electionName}
                        </span>
                    </div>
                    <h1 className="font-serif font-black text-3xl md:text-5xl uppercase tracking-tighter text-ink leading-none">
                        {city.ville}<br />
                        <span className="text-lassez-red">{deptName}</span> ({city.code_departement})
                    </h1>
                </div>

                <ElectionResultsLive electionSlug={electionSlug} initialVille={city.ville} initialDep={city.code_departement} />
            </div>
        </Layout>
    );
}
