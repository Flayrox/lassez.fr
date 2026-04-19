import { Metadata, ResolvingMetadata } from 'next';
import { generateSeoMetadata, generateSemanticSummary, formatCommuneSlug } from '@/lib/seo-engine';
import { getDepartmentName } from '@/lib/geo-data';
import Database from 'better-sqlite3';
import path from 'path';
import Layout from '@/components/Layout';
import { notFound, redirect } from 'next/navigation';
import { getNuanceConfig, STATUT_CONFIG } from '@/lib/election-colors';
import CitySearchBar from '@/components/CitySearchBar';
import Link from 'next/link';
import Script from 'next/script';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

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

async function fetchCityRowsFromStudio(codeInsee: string) {
  const studioBase = getStudioBaseUrl();
  if (!studioBase || process.env.IS_STUDIO) return null;

  try {
    const cityRes = await fetchWithTimeout(
      `${studioBase}/api/elections/results?slug=municipales-2026&city_by_insee=1&insee=${encodeURIComponent(codeInsee)}`,
      { cache: 'no-store' },
      1800
    );
    if (!cityRes.ok) return null;

    const cityJson = await cityRes.json();
    const city = cityJson?.city as { ville?: string; code_departement?: string } | null;
    if (!city?.ville || !city?.code_departement) return null;

    const rowsRes = await fetchWithTimeout(
      `${studioBase}/api/elections/results?slug=municipales-2026&ville=${encodeURIComponent(city.ville)}&dep=${encodeURIComponent(city.code_departement)}`,
      { cache: 'no-store' },
      1800
    );
    if (!rowsRes.ok) return null;

    const rowsJson = await rowsRes.json();
    const cityResult = Array.isArray(rowsJson?.results) ? rowsJson.results[0] : null;
    if (!cityResult) return null;

    const allRows: any[] = [];
    const tours = Array.isArray(cityResult.tours) ? cityResult.tours : [];
    for (const tourData of tours) {
      const tour = Number(tourData?.tour || 0);
      const candidats = Array.isArray(tourData?.candidats) ? tourData.candidats : [];
      for (const c of candidats) {
        allRows.push({
          tour,
          candidat: c?.candidat || '',
          nuance: c?.nuance || null,
          pct: Number(c?.pct || 0),
          voix: Number(c?.voix || 0),
          statut: c?.statut || 'elimine',
          code_departement: city.code_departement,
          ville: city.ville,
        });
      }
    }

    const deptRes = await fetchWithTimeout(
      `${studioBase}/api/elections/results?slug=municipales-2026&list_cities=1&dep=${encodeURIComponent(city.code_departement)}`,
      { cache: 'no-store' },
      1800
    );
    const deptJson = deptRes.ok ? await deptRes.json() : null;
    const deptCommunes = Array.isArray(deptJson?.cities)
      ? deptJson.cities.map((item: any) => ({
          code_insee: String(item?.code_insee || ''),
          ville: String(item?.ville || ''),
        }))
      : [];

    return {
      cityData: allRows[0] || null,
      allRows,
      deptCommunes,
    };
  } catch {
    return null;
  }
}

type Props = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = String(resolvedParams?.slug || '').trim();
  if (!slug) {
    return { title: 'Ville non trouvée' };
  }

  const codeInsee = slug.split('-')[0];
  let db;
  try {
    const remote = await fetchCityRowsFromStudio(codeInsee);
    if (remote?.cityData) {
      return generateSeoMetadata({
        codeInsee,
        nom: remote.cityData.ville,
        departement: remote.cityData.code_departement,
      });
    }

    db = getDb();
    const localCityData = db.prepare(`
      SELECT code_insee as codeInsee, ville as nom, code_departement as departement
      FROM elections_officiel_cache 
      WHERE code_insee = ? AND election_slug = 'municipales-2026'
      LIMIT 1
    `).get(codeInsee) as any;

    if (!localCityData) return { title: 'Ville non trouvée' };

    return generateSeoMetadata(localCityData);
  } catch (e) {
    return { title: 'Résultats Municipales 2026' };
  } finally {
    if (db) db.close();
  }
}

export default async function CommunePage({ params }: Props) {
  const resolvedParams = await params;
  const slug = String(resolvedParams?.slug || '').trim();

  if (!slug) {
    notFound();
  }

  const codeInsee = slug.split('-')[0];
  const citySlugPart = slug.split('-').slice(1).join('-');
  let db;
  let cityData: any = null;
  let allRows: any[] = [];
  let deptCommunes: { code_insee: string, ville: string }[] = [];

  try {
    const remote = await fetchCityRowsFromStudio(codeInsee);
    if (remote?.cityData) {
      cityData = remote.cityData;
      allRows = remote.allRows;
      deptCommunes = remote.deptCommunes;
    } else {
      db = getDb();

      // Vérification de sécurité: si la table n'existe pas encore
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='elections_officiel_cache'").get();
      if (!tableExists) {
          throw new Error('Table elections_officiel_cache missing');
      }

      allRows = db.prepare(`
        SELECT * 
        FROM elections_officiel_cache 
        WHERE code_insee = ? AND election_slug = 'municipales-2026'
        ORDER BY tour, pct DESC
      `).all(codeInsee);

      if (allRows.length > 0) {
        cityData = allRows[0];

        // Fetch all other communes in the same department
        deptCommunes = db.prepare(`
          SELECT DISTINCT code_insee, ville 
          FROM elections_officiel_cache 
          WHERE code_departement = ? AND election_slug = 'municipales-2026'
          ORDER BY ville
        `).all(cityData.code_departement) as { code_insee: string, ville: string }[];
      }
    }
  } catch (e) {
    // On reader/Hostinger env, local sqlite may be unavailable; fallback routing below handles this.
  } finally {
    if (db) db.close();
  }

  if (!cityData) {
    // Fallback for reader environments or malformed legacy slugs.
    const fallbackVille = citySlugPart
      .split('-')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .trim();
    const depGuess = String(codeInsee || '').slice(0, 2);

    if (fallbackVille) {
      const qs = new URLSearchParams({ ville: fallbackVille });
      if (/^[0-9]{2}$/.test(depGuess) || depGuess === '2A' || depGuess === '2B') {
        qs.set('dep', depGuess);
      }
      redirect(`/elections/municipales-2026?${qs.toString()}`);
    }

    notFound();
  }

  const deptName = getDepartmentName(cityData.code_departement) || 'Département inconnu';
  
  // Group results by tour with automatic winner detection
  const toursData = [1, 2].map(t => {
    const rawCands = allRows.filter(r => r.tour === t).map(r => ({
      id: r.id,
      candidat: r.candidat,
      nuance: r.nuance,
      pct: typeof r.pct === 'number' ? r.pct : 0,
      voix: typeof r.voix === 'number' ? r.voix : 0,
      statut: r.statut || 'elimine'
    }));

    // Logic intelligente d'élection
    const candidats = rawCands.sort((a, b) => (b.pct || 0) - (a.pct || 0)).map((c, idx) => {
        let finalStatut = c.statut;
        if (t === 1 && c.pct > 50) finalStatut = 'elu';
        if (t === 2 && idx === 0 && rawCands.length > 0) finalStatut = 'elu';
        return { ...c, statut: finalStatut };
    });

    return {
      tour: t,
      candidats,
      hasData: candidats.length > 0
    };
  });

  const semanticSummary = generateSemanticSummary(cityData.ville, deptName, toursData.find(t => t.hasData)?.candidats || []);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Accueil',
            'item': 'https://lassez.fr'
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Elections Municipales 2026',
            'item': 'https://lassez.fr/elections/municipales-2026'
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': deptName,
            'item': `https://lassez.fr/elections/municipales-2026/departement/${cityData.code_departement}`
          },
          {
            '@type': 'ListItem',
            'position': 4,
            'name': cityData.ville,
            'item': `https://lassez.fr/elections/municipales-2026/commune/${slug}`
          }
        ]
      },
      {
        '@type': 'Dataset',
        'name': `Résultats Municipales 2026 - ${cityData.ville}`,
        'description': semanticSummary,
        'creator': {
          '@type': 'Organization',
          'name': "L'Assez"
        }
      }
    ]
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-12">
        <Script id={`json-ld-commune-${slug}`} type="application/ld+json" strategy="beforeInteractive">
          {JSON.stringify(jsonLd)}
        </Script>
        
        {/* Barre de recherche omniprésente */}
        <div className="mb-8">
            <CitySearchBar />
        </div>

        {/* Header ville */}
        <div className="border-b-4 border-ink pb-6">
            <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[10px] text-lassez-red font-black uppercase tracking-widest bg-lassez-red/10 px-2 py-1">
                    Municipales 2026
                </span>
                <span className="font-mono text-[10px] text-ink/40 uppercase tracking-widest">
                    Résultats par commune
                </span>
            </div>
            <h1 className="font-serif font-black text-4xl md:text-6xl uppercase tracking-tighter text-ink leading-tight">
                {cityData.ville}<br />
                <span className="text-lassez-red">{deptName}</span> ({cityData.code_departement})
            </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Col Gauche : Résultats */}
            <div className="lg:col-span-2 space-y-12">
                {toursData.map(tour => tour.hasData && (
                    <div key={tour.tour} className="bg-paper-bright border-4 border-ink shadow-hard overflow-hidden">
                        <div className="bg-ink text-paper px-6 py-4 flex items-center justify-between">
                            <h2 className="font-serif font-black uppercase text-xl md:text-2xl tracking-tighter leading-none">
                                {tour.tour === 1 ? 'Premier Tour' : 'Second Tour'}
                            </h2>
                            <span className="font-mono text-[9px] font-black uppercase tracking-widest px-3 py-1 bg-stone-700 text-white">
                                DÉFINITIF
                            </span>
                        </div>
                        
                        {/* Dossier Verdict */}
                        {tour.tour === 1 && tour.candidats.some(c => c.statut === 'elu') && (
                            <div className="bg-yellow-100/50 border-b-2 border-yellow-200 px-6 py-2 flex items-center justify-between">
                                <span className="font-mono text-[9px] font-black text-yellow-800 uppercase tracking-widest flex items-center gap-2">
                                    🏆 ÉLECTION AU 1ER TOUR
                                </span>
                            </div>
                        )}
                        {tour.tour === 2 && tour.candidats.some(c => c.statut === 'elu') && (
                            <div className="bg-green-100/50 border-b-2 border-green-200 px-6 py-2 flex items-center justify-between">
                                <span className="font-mono text-[9px] font-black text-green-800 uppercase tracking-widest flex items-center gap-2">
                                    🗳️ VERDICT FINAL
                                </span>
                            </div>
                        )}

                        <div className="p-6">
                            {tour.candidats.map((c, idx) => {
                                const nuance = getNuanceConfig(c.nuance);
                                const statut = STATUT_CONFIG[c.statut as any] || STATUT_CONFIG.elimine;
                                const maxPct = Math.max(...tour.candidats.map(can => can.pct || 0)) || 100;
                                const barWidth = maxPct > 0 ? ((c.pct || 0) / maxPct) * 100 : 0;
                                const isEliminated = c.statut === 'elimine' || c.statut === 'retrait';

                                return (
                                    <div key={idx} className={`py-4 border-b border-ink/8 last:border-0 ${isEliminated ? 'opacity-50' : ''}`}>
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`font-serif font-black text-lg leading-tight text-ink ${isEliminated ? 'line-through decoration-ink/30' : ''}`}>
                                                        {c.candidat}
                                                    </span>
                                                    {c.statut === 'elu' ? (
                                                        <span className="font-mono text-[8px] font-black px-1.5 py-0.5 tracking-widest uppercase bg-green-600 text-white flex items-center gap-1 shadow-sm">
                                                            ★ VAINQUEUR
                                                        </span>
                                                    ) : (
                                                        <span className="font-mono text-[8px] font-black px-1.5 py-0.5 tracking-widest uppercase" style={{ backgroundColor: statut.bg, color: statut.text }}>
                                                            {statut.label}
                                                        </span>
                                                    )}
                                                    {c.nuance && (
                                                        <span className="font-mono text-[8px] font-black px-1.5 py-0.5 tracking-wider uppercase" style={{ backgroundColor: nuance.badge, color: nuance.text }}>
                                                            {nuance.label}
                                                        </span>
                                                    )}
                                                </div>
                                                {(c.voix || 0) > 0 && (
                                                    <span className="font-mono text-[9px] text-ink/40 mt-1 block font-bold uppercase tracking-tighter">
                                                        {(c.voix || 0).toLocaleString('fr-FR')} voix • {(c.pct || 0).toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <span className="font-serif font-black text-3xl md:text-4xl tabular-nums leading-none" style={{ color: isEliminated ? '#9CA3AF' : nuance.bg }}>
                                                    {(c.pct || 0).toFixed(1).replace('.', ',')}
                                                </span>
                                                <span className="font-mono text-xs text-ink/40 ml-0.5">%</span>
                                            </div>
                                        </div>
                                        <div className="h-4 bg-ink/8 w-full overflow-hidden">
                                            <div className="h-full transition-all duration-700 ease-out" style={{ width: `${barWidth}%`, backgroundColor: isEliminated ? '#D1D5DB' : nuance.bg }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Col Droite : Analyse & Sidebar */}
            <div className="space-y-12">
                <div className="bg-lassez-red text-paper p-8 border-4 border-ink shadow-hard">
                    <h2 className="font-serif font-black text-2xl uppercase tracking-tighter mb-4 border-b-2 border-paper/20 pb-2">
                        L'Analyse Silo
                    </h2>
                    <p className="font-serif text-lg leading-relaxed italic">
                        "{semanticSummary}"
                    </p>
                    <div className="mt-6 font-mono text-[10px] font-black uppercase tracking-widest opacity-60">
                        Analyse générée en temps réel par la rédaction
                    </div>
                </div>

                <div className="border-4 border-ink p-6 bg-paper-bright">
                    <h3 className="font-serif font-black uppercase text-xl tracking-tighter text-ink mb-4 border-b-2 border-ink pb-2">
                        Silo <span className="text-lassez-red">Départemental</span>
                    </h3>
                    <p className="font-serif text-ink/70 text-sm mb-4 leading-tight">
                        Explorez les résultats de toutes les communes du département de {deptName}.
                    </p>
                    <a 
                        href="#all-cities"
                        className="inline-block w-full text-center bg-ink text-paper py-3 font-mono text-xs font-black uppercase tracking-widest hover:bg-lassez-red transition-colors shadow-hard-sm"
                    >
                        Toutes les villes ({cityData.code_departement}) ↓
                    </a>
                </div>
            </div>
        </div>

        {/* Section Toutes les villes du département */}
        <div id="all-cities" className="pt-12 border-t-4 border-ink">
            <h2 className="font-serif font-black uppercase text-2xl md:text-3xl tracking-tighter text-ink mb-8">
                Toutes les communes : <span className="text-lassez-red">{deptName}</span> ({cityData.code_departement})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {deptCommunes.map((commune) => (
                    <Link
                        key={commune.code_insee}
                        href={`/elections/municipales-2026/commune/${formatCommuneSlug(commune.code_insee, commune.ville)}`}
                        className="font-mono text-[10px] font-black uppercase py-2 px-3 border-2 border-ink/10 hover:border-lassez-red hover:text-lassez-red transition-all truncate bg-white shadow-hard-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5"
                        title={commune.ville}
                    >
                        {commune.ville}
                    </Link>
                ))}
            </div>
        </div>
      </div>
    </Layout>
  );
}
