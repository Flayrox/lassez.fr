import Link from 'next/link';
import { redirect } from 'next/navigation';
import Database from 'better-sqlite3';
import path from 'path';
import Layout from '../../components/Layout';
import { formatElectionLabel, parseJsonArray } from '../../lib/elections';

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath);
}

export const dynamic = 'force-dynamic';

export default function ElectionsHub() {
    let db: any = null;
    try {
        db = getDb();
        const rows = db.prepare('SELECT key, value FROM radar_settings WHERE key IN (?, ?)').all(
            'election_front_display_slugs_json',
            'election_analysis_target_slug'
        ) as { key: string; value: string }[];
        const settingsMap = Object.fromEntries(rows.map(r => [String(r.key), String(r.value || '')]));
        const displaySlugs = parseJsonArray(settingsMap.election_front_display_slugs_json, ['municipales-2026']);
            
        if (displaySlugs.length <= 1) {
            const onlySlug = displaySlugs[0] || settingsMap.election_analysis_target_slug || 'municipales-2026';
            redirect(`/elections/${onlySlug}`);
        }

        const targetSlug = String(settingsMap.election_analysis_target_slug || 'municipales-2026');

        return (
            <Layout>
                <section className="max-w-5xl mx-auto px-4 py-10 md:py-14">
                    <div className="border-b-4 border-ink pb-4 mb-8">
                        <h1 className="font-serif font-black text-3xl md:text-5xl uppercase tracking-tighter text-ink leading-none">
                            Hub <span className="text-lassez-red">Elections</span>
                        </h1>
                        <p className="mt-3 font-serif text-ink/70 text-base md:text-lg max-w-2xl">
                            Choisissez le scrutin a consulter. Le flux d'analyse actif est marque pour faciliter la bascule entre cycles.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {displaySlugs.map((slug) => {
                            const isTarget = slug === targetSlug;
                            return (
                                <Link
                                    key={slug}
                                    href={`/elections/${slug}`}
                                    className="border-2 border-ink bg-paper-bright p-5 shadow-hard-sm hover:-translate-y-1 hover:-translate-x-1 hover:shadow-hard transition-all"
                                >
                                    <div className="flex items-center justify-between gap-3 mb-3">
                                        <span className="font-mono text-[10px] font-black uppercase tracking-widest bg-ink text-paper px-2 py-1">
                                            {isTarget ? 'ANALYSE ACTIVE' : 'AFFICHE'}
                                        </span>
                                    </div>
                                    <h2 className="font-serif font-black uppercase text-2xl tracking-tight text-ink">
                                        {formatElectionLabel(slug)}
                                    </h2>
                                    <p className="font-mono text-[10px] uppercase tracking-wider text-ink/50 mt-2">/{slug}</p>
                                </Link>
                            );
                        })}
                    </div>
                </section>
            </Layout>
        );
    } catch {
        redirect('/elections/municipales-2026');
    } finally {
        if (db) {
            try { db.close(); } catch (_) {}
        }
    }
}
