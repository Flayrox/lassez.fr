import { Metadata } from 'next';
import Layout from '../../../../../components/Layout';
import { departments as deptNames } from '../../../../../lib/geo-data';
import { formatCommuneSlug } from '../../../../../lib/seo-engine';
import Database from 'better-sqlite3';
import path from 'path';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import CitySearchBar from '@/components/CitySearchBar';

interface PageProps {
    params: {
        'code-dept': string;
    };
}

async function getCommunes(codeDept: string) {
    try {
        const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
        const db = new Database(dbPath);
        const rows = db.prepare('SELECT DISTINCT code_insee, ville FROM elections_officiel_cache WHERE code_departement = ? AND election_slug = "municipales-2026" ORDER BY ville').all(codeDept) as { code_insee: string, ville: string }[];
        db.close();
        return rows;
    } catch (error) {
        console.error('Error fetching communes:', error);
        return [];
    }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const codeDept = params['code-dept'];
    const deptName = deptNames[codeDept];

    if (!deptName) {
        return {
            title: 'Département non trouvé',
        };
    }

    const title = `Résultats Municipales 2026 : ${deptName} (${codeDept}) — L'Assez`;
    const description = `Découvrez les résultats des élections municipales 2026 pour toutes les communes du département ${deptName} (${codeDept}). Analyses et scores en direct.`;

    return {
        title,
        description,
        alternates: {
            canonical: `https://lassez.fr/elections/municipales-2026/departement/${codeDept}`,
        },
    };
}

export default async function DepartmentHub({ params }: PageProps) {
    const codeDept = params['code-dept'];
    const deptName = deptNames[codeDept];

    if (!deptName) {
        notFound();
    }

    const communes = await getCommunes(codeDept);

    return (
        <Layout>
            <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8">
                {/* Barre de recherche omniprésente */}
                <CitySearchBar />

                <div className="border-b-4 border-ink pb-4 mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Link 
                            href="/elections/municipales-2026"
                            className="font-mono text-[9px] font-black uppercase tracking-widest text-lassez-red hover:underline"
                        >
                            ← Retour National
                        </Link>
                        <span className="font-mono text-[9px] text-ink/40 uppercase tracking-widest">
                            Municipales 2026
                        </span>
                    </div>
                    <h1 className="font-serif font-black text-3xl md:text-5xl uppercase tracking-tighter text-ink leading-none">
                        Département<br />
                        <span className="text-lassez-red">{deptName}</span> ({codeDept})
                    </h1>
                    <p className="mt-3 font-serif text-ink/70 text-base md:text-lg max-w-2xl">
                        Retrouvez les résultats du scrutin pour les {communes.length} communes du département.
                    </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {communes.map((commune) => {
                        const slug = formatCommuneSlug(commune.code_insee, commune.ville);
                        return (
                            <Link
                                key={commune.code_insee}
                                href={`/elections/municipales-2026/commune/${slug}`}
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
                        Aucune donnée disponible pour ce département pour le moment.
                    </p>
                )}
            </div>
        </Layout>
    );
}
