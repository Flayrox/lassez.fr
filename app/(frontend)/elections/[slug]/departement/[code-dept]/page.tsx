import { Metadata } from 'next';
import Layout from '@/components/Layout';
import { departments as deptNames } from '@/lib/geo-data';
import { formatCommuneSlug } from '@/lib/seo-engine';
import { formatElectionLabel } from '@/lib/elections';
import Database from 'better-sqlite3';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CitySearchBar from '@/components/CitySearchBar';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

interface PageProps {
    params: {
        slug: string;
        'code-dept': string;
    };
}

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

async function getCommunes(electionSlug: string, codeDept: string) {
    let db: any = null;
    try {
        const studioBase = getStudioBaseUrl();
        if (studioBase && !process.env.IS_STUDIO) {
            const res = await fetchWithTimeout(
                `${studioBase}/api/elections/results?slug=${encodeURIComponent(electionSlug)}&list_cities=1&dep=${encodeURIComponent(codeDept)}`,
                { cache: 'no-store' },
                1800
            );
            if (res.ok) {
                const data = await res.json();
                const cities = Array.isArray(data?.cities) ? data.cities : [];
                if (cities.length) return cities as { code_insee: string; ville: string }[];
            }
        }

        db = getDb();
        const rows = db.prepare(
            'SELECT DISTINCT code_insee, ville FROM elections_officiel_cache WHERE code_departement = ? AND election_slug = ? ORDER BY ville'
        ).all(codeDept, electionSlug) as { code_insee: string; ville: string }[];
        return rows;
    } catch {
        return [];
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const electionSlug = String(params.slug || '');
    const codeDept = params['code-dept'];
    const deptName = deptNames[codeDept] || `Departement ${codeDept}`;
    const electionName = formatElectionLabel(electionSlug || 'elections');

    return {
        title: `Resultats ${electionName} : ${deptName} (${codeDept}) — L'Assez`,
        description: `Resultats ${electionName} pour les communes du departement ${deptName} (${codeDept}).`,
        alternates: {
            canonical: `https://lassez.fr/elections/${electionSlug}/departement/${codeDept}`,
        },
    };
}

export default async function DepartmentSlugPage({ params }: PageProps) {
    const electionSlug = String(params.slug || '').trim();
    const codeDept = params['code-dept'];
    if (!electionSlug || !codeDept) {
        notFound();
    }

    const deptName = deptNames[codeDept] || `Departement ${codeDept}`;
    const electionName = formatElectionLabel(electionSlug);
    const communes = await getCommunes(electionSlug, codeDept);

    return (
        <Layout>
            <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8">
                <CitySearchBar electionSlug={electionSlug} />

                <div className="border-b-4 border-ink pb-4 mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            href={`/elections/${electionSlug}`}
                            className="font-mono text-[9px] font-black uppercase tracking-widest text-lassez-red hover:underline"
                        >
                            Retour national
                        </Link>
                        <span className="font-mono text-[9px] text-ink/40 uppercase tracking-widest">
                            {electionName}
                        </span>
                    </div>
                    <h1 className="font-serif font-black text-3xl md:text-5xl uppercase tracking-tighter text-ink leading-none">
                        Departement<br />
                        <span className="text-lassez-red">{deptName}</span> ({codeDept})
                    </h1>
                    <p className="mt-3 font-serif text-ink/70 text-base md:text-lg max-w-2xl">
                        Retrouvez les resultats pour les {communes.length} communes du departement.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {communes.map((commune) => {
                        const slug = formatCommuneSlug(commune.code_insee, commune.ville);
                        return (
                            <Link
                                key={commune.code_insee}
                                href={`/elections/${electionSlug}/commune/${slug}`}
                                className="font-mono text-[10px] font-black uppercase py-2 px-3 border-2 border-ink/10 hover:border-lassez-red hover:text-lassez-red transition-all truncate bg-white shadow-hard-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
                                title={commune.ville}
                            >
                                {commune.ville}
                            </Link>
                        );
                    })}
                </div>

                {communes.length === 0 && (
                    <p className="font-serif italic text-ink/40">
                        Aucune donnee disponible pour ce departement et ce scrutin pour le moment.
                    </p>
                )}
            </div>
        </Layout>
    );
}
