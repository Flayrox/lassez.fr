import { NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import { logToDaemon, errorToDaemon } from '../../logger';
import { fetchWithTimeout } from '@/lib/fetch-timeout';

export const dynamic = 'force-dynamic';
const syncLocks = new Map<string, Promise<void>>();

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

function safeCloseDb(db: any) {
    if (!db) return;
    try {
        db.close();
    } catch (_) {
        // Ignore close failures to avoid masking the main error
    }
}

function withCache(data: any, cacheControl: string) {
    const res = NextResponse.json(data);
    res.headers.set('Cache-Control', cacheControl);
    return res;
}

function parseJsonObject(raw: string | undefined, fallback: any = {}) {
    if (!raw) return fallback;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch (_) {
        return fallback;
    }
}

function ensureTable(db: any) {
    // Overrides manuels du Radar-Admin
    db.exec(`
        CREATE TABLE IF NOT EXISTS elections_resultats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_slug TEXT NOT NULL DEFAULT 'municipales-2026',
            ville TEXT NOT NULL,
            tour INTEGER NOT NULL DEFAULT 1,
            candidat TEXT NOT NULL,
            nuance TEXT,
            pct REAL NOT NULL DEFAULT 0,
            voix INTEGER DEFAULT 0,
            statut TEXT DEFAULT 'elimine' CHECK(statut IN ('elu', 'qualifie', 'elimine', 'retrait')),
            active INTEGER DEFAULT 1,
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(election_slug, ville, tour, candidat)
        )
    `);

    // Cache des données officielles de l'État (35 000 communes)
    db.exec(`
        CREATE TABLE IF NOT EXISTS elections_officiel_cache (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            election_slug TEXT NOT NULL,
            code_departement TEXT,
            code_insee TEXT,
            ville TEXT NOT NULL,
            ville_norm TEXT,
            tour INTEGER NOT NULL,
            candidat TEXT NOT NULL,
            nuance TEXT,
            pct REAL NOT NULL,
            voix INTEGER,
            statut TEXT,
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_ville ON elections_officiel_cache(ville);
        CREATE INDEX IF NOT EXISTS idx_ville_norm ON elections_officiel_cache(ville_norm);
        CREATE INDEX IF NOT EXISTS idx_slug ON elections_officiel_cache(election_slug);
        CREATE INDEX IF NOT EXISTS idx_v_d ON elections_officiel_cache(ville, code_departement);
        CREATE INDEX IF NOT EXISTS idx_insee ON elections_officiel_cache(code_insee);
        
        CREATE TABLE IF NOT EXISTS elections_sync_status (
            election_slug TEXT PRIMARY KEY,
            last_sync TEXT
        );
    `);

    // Migration logic for existing installations
    try {
        db.prepare('SELECT ville_norm FROM elections_officiel_cache LIMIT 1').get();
    } catch (e) {
        logToDaemon('[Élections] Migration : Ajout de la colonne ville_norm');
        db.exec('ALTER TABLE elections_officiel_cache ADD COLUMN ville_norm TEXT');
        db.exec('CREATE INDEX IF NOT EXISTS idx_ville_norm ON elections_officiel_cache(ville_norm)');
    }
}

// Helper pour fetcher et parser un CSV en streaming
async function fetchAndStreamCsv(url: string, onRow: (row: any, index: number) => void) {
    const https = (await import('https')).default;
    const csv = (await import('csv-parser')).default as any;
    const parser = typeof csv === 'function' ? csv({ separator: ';' }) : csv.default({ separator: ';' });

    return new Promise((resolve, reject) => {
        let count = 0;
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode} for ${url}`));
            res.pipe(parser)
                .on('data', (row: any) => onRow(row, count++))
                .on('end', () => resolve(count))
                .on('error', reject);
        }).on('error', reject);
    });
}

async function syncOfficialData(db: any, electionSlug: string, force: boolean = false) {
    try {
        const status = db.prepare('SELECT last_sync FROM elections_sync_status WHERE election_slug = ?').get(electionSlug);
        const lastSync = status ? new Date(status.last_sync).getTime() : 0;
        const now = Date.now();

        const checkMigration = db.prepare('SELECT COUNT(*) as count FROM elections_officiel_cache WHERE ville_norm IS NULL LIMIT 1').get();
        const needsMigration = checkMigration && checkMigration.count > 0;

        if (!force && !needsMigration && (now - lastSync < 30 * 60 * 1000)) return;

        logToDaemon(`[Élections] Début Double-Sync : ${electionSlug} (force: ${force})`);

        const getLatestCsv = async (datasetSlug: string, keyword: string) => {
            const res = await fetch(`https://www.data.gouv.fr/api/1/datasets/${datasetSlug}/`);
            if (!res.ok) return null;
            const data = await res.json();
            const resources = (data.resources || []).filter((r: any) => {
                const title = r.title ? r.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
                return r.format?.toLowerCase() === 'csv' && title.includes(keyword) && !title.includes('bv') && !title.includes('polynesie');
            });
            if (resources.length === 0) return null;
            resources.sort((a: any, b: any) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
            return resources[0].url;
        };

        const settingsRows = db.prepare('SELECT key, value FROM radar_settings').all();
        const settingsMap: Record<string, string> = {};
        for (const row of settingsRows) settingsMap[String(row.key)] = String(row.value || '');
        const sourcesMap = parseJsonObject(settingsMap.election_sources_json, {});
        const sourceCfg = sourcesMap[electionSlug] && typeof sourcesMap[electionSlug] === 'object' ? sourcesMap[electionSlug] : {};

        const defaultDatasets = {
            firstTour: 'elections-municipales-2026-resultats-du-premier-tour',
            secondTour: 'elections-municipales-2026-resultats-du-second-tour',
            candidatures1: 'elections-municipales-2026-listes-candidates-au-premier-tour',
            candidatures2: 'elections-municipales-2026-listes-candidates-au-second-tour'
        };

        const firstTourResultsUrl = sourceCfg.results_first_tour_url || await getLatestCsv(sourceCfg.dataset_first_tour || defaultDatasets.firstTour, 'communes');
        const secondTourResultsUrl = sourceCfg.results_second_tour_url || await getLatestCsv(sourceCfg.dataset_second_tour || defaultDatasets.secondTour, 'communes');
        const candidatures1Url = sourceCfg.candidatures_first_tour_url || await getLatestCsv(sourceCfg.candidate_first_tour || defaultDatasets.candidatures1, 'candidatures');
        const candidatures2Url = sourceCfg.candidatures_second_tour_url || await getLatestCsv(sourceCfg.candidate_second_tour || defaultDatasets.candidatures2, 'candidatures');

        const candidatesMap: Record<string, { tete: string; nuanceLabel: string }> = {};
        
        const indexCandidatures = async (url: string) => {
            if (!url) return;
            logToDaemon(`[Élections] Indexation Candidatures : ${url}`);
            await fetchAndStreamCsv(url, (row) => {
                if (row['Tête de liste'] === 'OUI' || row['Ordre'] === '1') {
                    const dep = row['Code département'] || row['CODDPT'];
                    const ville = row['Circonscription'] || row['Libellé de la commune'];
                    const liste = row['Libellé de la liste'] || row['Libellé abrégé de liste'];
                    const nom = row['Nom sur le bulletin de vote'] || row['Nom'];
                    const prenom = row['Prénom sur le bulletin de vote'] || row['Prénom'];
                    const nuance = row['Nuance de liste'] || row['Code nuance de liste'];
                    
                    if (dep && ville && liste) {
                        const key = `${dep.trim().toUpperCase()}|${ville.trim().toUpperCase()}|${liste.trim().toUpperCase()}`;
                        candidatesMap[key] = {
                            tete: `${prenom} ${nom}`.trim(),
                            nuanceLabel: nuance
                        };
                    }
                }
            });
        };

        await indexCandidatures(candidatures1Url);
        await indexCandidatures(candidatures2Url);

        logToDaemon('[Élections] Phase Résultats...');
        db.prepare('DELETE FROM elections_officiel_cache WHERE election_slug = ?').run(electionSlug);
        
        const insertStmt = db.prepare(`
            INSERT INTO elections_officiel_cache (election_slug, code_departement, code_insee, ville, ville_norm, tour, candidat, nuance, pct, voix, statut)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((rows: any[]) => {
            for (const row of rows) insertStmt.run(row);
        });

        let buffer: any[] = [];
        let totalProcessed = 0;

        const processResults = async (url: string, tourNum: number) => {
            if (!url) return;
            logToDaemon(`[Élections] Traitement Tour ${tourNum} : ${url}`);
            const count = await fetchAndStreamCsv(url, (row) => {
                const ville = row['Libellé commune'] || row['Libellé de la commune'];
                let dep = (row['Code département'] || row['Code du département'] || row['CODDPT'] || '').toString().trim();
                let com = (row['Code commune'] || row['Code de la commune'] || row['CODCOM'] || '').toString().trim();
                
                if (dep.length === 1) dep = '0' + dep;
                if (com.length === 1) com = '00' + com;
                if (com.length === 2) com = '0' + com;
                
                const insee = dep + com;
                if (!ville) return;

                const villeKey = `${dep}|${ville.trim().toUpperCase()}`;

                for (let j = 1; j <= 40; j++) {
                    const voixStr = row[`Voix ${j}`];
                    if (voixStr === undefined || voixStr === '') continue;

                    const nomRes = row[`Nom candidat ${j}`] || '';
                    const prenomRes = row[`Prénom candidat ${j}`] || '';
                    const listeRes = row[`Libellé de liste ${j}`] || row[`Libellé abrégé de liste ${j}`] || '';
                    
                    const listKey = listeRes.trim().toUpperCase();
                    const mapInfo = candidatesMap[`${villeKey}|${listKey}`];
                    
                    let candidatFinal = '';
                    if (mapInfo && mapInfo.tete) {
                        candidatFinal = `${mapInfo.tete} (${listeRes})`;
                    } else if (nomRes) {
                        candidatFinal = `${prenomRes} ${nomRes}`.trim();
                    } else {
                        candidatFinal = listeRes;
                    }

                    if (!candidatFinal) continue;

                    const pctStr = row[`% Voix/exprimés ${j}`] || '0';
                    const pct = parseFloat(pctStr.replace(',', '.').replace('%', '')) || 0;
                    const voix = parseInt(voixStr, 10) || 0;
                    const nuance = row[`Nuance liste ${j}`] || (mapInfo?.nuanceLabel) || null;
                    const elu = row[`Elu ${j}`]?.toLowerCase() === 'oui' ? 'elu' : (pct > 10 ? 'qualifie' : 'elimine');

                    const villeNorm = ville.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
                    buffer.push([electionSlug, dep, insee, ville, villeNorm, tourNum, candidatFinal, nuance, pct, voix, elu]);

                    if (buffer.length >= 500) {
                        transaction(buffer);
                        buffer = [];
                    }
                }
            });
            totalProcessed += (count as number);
        };

        if (firstTourResultsUrl) await processResults(firstTourResultsUrl, 1);
        if (secondTourResultsUrl) await processResults(secondTourResultsUrl, 2);

        if (buffer.length > 0) transaction(buffer);
        
        db.prepare('INSERT OR REPLACE INTO elections_sync_status (election_slug, last_sync) VALUES (?, ?)').run(electionSlug, new Date().toISOString());

        const usedSource = {
            slug: electionSlug,
            used_at: new Date().toISOString(),
            results_first_tour_url: firstTourResultsUrl || null,
            results_second_tour_url: secondTourResultsUrl || null,
            candidatures_first_tour_url: candidatures1Url || null,
            candidatures_second_tour_url: candidatures2Url || null,
            success: true
        };
        const lastUsedMap = parseJsonObject(settingsMap.election_last_used_source_json, {});
        lastUsedMap[electionSlug] = usedSource;
        db.prepare('INSERT OR REPLACE INTO radar_settings (key, value) VALUES (?, ?)')
            .run('election_last_used_source_json', JSON.stringify(lastUsedMap));
        logToDaemon(`[Élections] Double-Sync Terminé : ${totalProcessed} communes traitées.`);
        
    } catch (e) {
        errorToDaemon('[Élections] Critical Double-Sync Error:', e);
    }
}

async function runSyncWithLock(electionSlug: string, force: boolean = false) {
    const existing = syncLocks.get(electionSlug);
    if (existing && !force) {
        await existing;
        return;
    }
    if (existing && force) {
        await existing;
    }

    const syncPromise = (async () => {
        let syncDb: any = null;
        try {
            syncDb = getDb();
            ensureTable(syncDb);
            await syncOfficialData(syncDb, electionSlug, force);
        } finally {
            safeCloseDb(syncDb);
        }
    })();

    syncLocks.set(electionSlug, syncPromise);
    try {
        await syncPromise;
    } finally {
        if (syncLocks.get(electionSlug) === syncPromise) {
            syncLocks.delete(electionSlug);
        }
    }
}

export interface Candidat {
    id: number;
    candidat: string;
    nuance: string | null;
    pct: number;
    voix: number;
    statut: 'elu' | 'qualifie' | 'elimine' | 'retrait';
}

export interface TourResult {
    tour: number;
    candidats: Candidat[];
    hasData: boolean;
}

export interface VilleResult {
    ville: string;
    tours: TourResult[];
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const isProxied = request.headers.get('x-radar-proxy') === '1';

    const studioBase = getStudioBaseUrl();
    if (studioBase && !process.env.IS_STUDIO && !isProxied) {
        try {
            const qs = searchParams.toString();
            const res = await fetchWithTimeout(
                `${studioBase}/api/elections/results${qs ? `?${qs}` : ''}`,
                { 
                    cache: 'no-store',
                    headers: { 'x-radar-proxy': '1' }
                },
                1800
            );
            const data = await res.json();
            return NextResponse.json(data, {
                status: res.status,
                headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=120' },
            });
        } catch (_) {
            // Fall through to local behavior if Studio is unreachable.
        }
    }

    const electionSlug = searchParams.get('slug') || 'municipales-2026';
    const query = searchParams.get('q');
    const suggest = searchParams.get('suggest'); 
    const all = searchParams.get('all') === '1';
    const forceSync = searchParams.get('forceSync') === '1';
    const listCities = searchParams.get('list_cities') === '1';
    const listDepartments = searchParams.get('list_departments') === '1';
    const cityByInsee = searchParams.get('city_by_insee') === '1';

    let db: any = null;
    try {
        db = getDb();
        ensureTable(db);

        // Tâche de fond pour la sync (ou forcee)
        if (forceSync || (!all && !query && !searchParams.get('ville') && !listCities && !listDepartments && !cityByInsee)) {
            if (forceSync) {
                await runSyncWithLock(electionSlug, true);
            } else {
                runSyncWithLock(electionSlug, false).catch((e) => errorToDaemon('[Élections] Background sync error:', e));
            }
        }

        if (listDepartments) {
            const departments = db.prepare(`
                SELECT DISTINCT code_departement
                FROM elections_officiel_cache
                WHERE election_slug = ? AND code_departement IS NOT NULL
                ORDER BY code_departement ASC
            `).all(electionSlug) as { code_departement: string }[];

            safeCloseDb(db);
            db = null;
            return withCache({ success: true, departments: departments.map(d => d.code_departement).filter(Boolean) }, 'public, max-age=60, stale-while-revalidate=300');
        }

        if (cityByInsee && searchParams.get('insee')) {
            const insee = String(searchParams.get('insee') || '').trim();
            const city = db.prepare(`
                SELECT code_insee, ville, code_departement
                FROM elections_officiel_cache
                WHERE election_slug = ? AND code_insee = ?
                LIMIT 1
            `).get(electionSlug, insee);

            safeCloseDb(db);
            db = null;
            return withCache({ success: true, city: city || null }, 'public, max-age=60, stale-while-revalidate=300');
        }

        // 0. Mode liste des villes par département
        if (listCities && searchParams.get('dep')) {
            const dep = searchParams.get('dep');
            const cities = db.prepare(`
                SELECT DISTINCT ville, code_insee 
                FROM elections_officiel_cache 
                WHERE election_slug = ? AND code_departement = ?
                ORDER BY ville ASC
            `).all(electionSlug, dep);
            
            safeCloseDb(db);
            db = null;
            return withCache({
                success: true,
                cities
            }, 'public, max-age=60, stale-while-revalidate=300');
        }

        // 1. Mode suggestion (Autocomplete avec département)
        if (suggest && suggest.length >= 2) {
            const isNumeric = /^\d+$/.test(suggest);
            const normalizedSuggest = suggest.normalize("NFD")
                .toLowerCase()
                .replace(/\bst\b/g, 'saint')
                .replace(/\bste\b/g, 'sainte')
                .replace(/[^a-z0-9]/g, "");
            
            const params = isNumeric 
                ? [electionSlug, suggest, `${suggest}%`]
                : [electionSlug, `%${normalizedSuggest}%`, `${normalizedSuggest}%`, normalizedSuggest];

            const suggestions = isNumeric 
                ? db.prepare(`
                    SELECT DISTINCT ville, code_departement, code_insee FROM elections_officiel_cache 
                    WHERE election_slug = ? AND (code_departement = ? OR code_insee LIKE ?)
                    LIMIT 10
                  `).all(...params)
                : db.prepare(`
                    SELECT DISTINCT ville, code_departement, code_insee FROM elections_officiel_cache 
                    WHERE election_slug = ? AND ville_norm LIKE ?
                    ORDER BY 
                        CASE WHEN ville_norm LIKE ? THEN 0 ELSE 1 END,
                        CASE WHEN ville_norm = ? THEN 0 ELSE 1 END,
                        ville
                    LIMIT 10
                  `).all(...params);

            safeCloseDb(db);
            db = null;
            return withCache({
                success: true,
                suggestions: suggestions.map(s => ({
                    name: `${s.ville} (${s.code_departement})`,
                    slug: s.ville.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^\w-]/g, ''),
                    ville: s.ville,
                    dep: s.code_departement,
                    insee: s.code_insee
                }))
            }, 'public, max-age=60, stale-while-revalidate=300');
        }

        // 2. Overrides locaux
        const localQuery = all
            ? `SELECT * FROM elections_resultats WHERE election_slug = ? ORDER BY ville, tour, pct DESC`
            : `SELECT * FROM elections_resultats WHERE election_slug = ? AND active = 1 ORDER BY ville, tour, pct DESC`;
        const localRows = db.prepare(localQuery).all(electionSlug) as any[];

        const localByVille: Record<string, Record<number, Candidat[]>> = {};
        for (const row of localRows) {
            if (!localByVille[row.ville]) localByVille[row.ville] = {};
            if (!localByVille[row.ville][row.tour]) localByVille[row.ville][row.tour] = [];
            localByVille[row.ville][row.tour].push({
                id: row.id,
                candidat: row.candidat,
                nuance: row.nuance || null,
                pct: row.pct,
                voix: row.voix || 0,
                statut: row.statut || 'elimine',
            });
        }

        if (all) {
            safeCloseDb(db);
            db = null;
            const results = Object.entries(localByVille).map(([ville, tours]) => ({
                ville,
                tours: [1, 2].map(t => ({ tour: t, candidats: (tours[t] || []).sort((a,b)=>b.pct-a.pct), hasData: !!tours[t]?.length }))
            }));
            return NextResponse.json({ success: true, results });
        }

        // 3. Données officielles
        const targetedVille = searchParams.get('ville');
        const targetedDep = searchParams.get('dep');

        let officialRows: any[] = [];
        if (targetedVille) {
            logToDaemon(`[Élections] Recherche ciblée : ${targetedVille} (dep: ${targetedDep})`);
            
            const normPath = targetedVille.normalize("NFD")
                .toLowerCase()
                .replace(/\bst\b/g, 'saint')
                .replace(/\bste\b/g, 'sainte')
                .replace(/[^a-z0-9]/g, "");
            
            const querySelect = targetedDep 
                ? `SELECT * FROM elections_officiel_cache 
                   WHERE election_slug = ? 
                   AND (ville_norm = ? OR ville = ? OR REPLACE(LOWER(ville), ' ', '-') = ?)
                   AND code_departement = ? 
                   ORDER BY pct DESC`
                : `SELECT * FROM elections_officiel_cache 
                   WHERE election_slug = ? 
                   AND (ville_norm = ? OR ville = ? OR REPLACE(LOWER(ville), ' ', '-') = ?)
                   ORDER BY pct DESC`;
            
            const params = targetedDep 
                ? [electionSlug, normPath, targetedVille, targetedVille.toLowerCase(), targetedDep] 
                : [electionSlug, normPath, targetedVille, targetedVille.toLowerCase()];
            
            officialRows = db.prepare(querySelect).all(...params) as any[];
            logToDaemon(`[Élections] Résultat : ${officialRows.length} lignes trouvées pour ${targetedVille}`);
        } else if (query && query.length >= 2) {
            const isNumeric = /^\d+$/.test(query);
            const normalizedQuery = query.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");

            if (isNumeric) {
                officialRows = db.prepare(`
                    SELECT * FROM elections_officiel_cache 
                    WHERE election_slug = ? AND (code_departement = ? OR code_insee LIKE ?)
                    ORDER BY ville, pct DESC
                `).all(electionSlug, query, `${query}%`) as any[];
            } else {
                officialRows = db.prepare(`
                    SELECT * FROM elections_officiel_cache 
                    WHERE election_slug = ? AND ville_norm LIKE ?
                    ORDER BY ville, pct DESC
                `).all(electionSlug, `%${normalizedQuery}%`) as any[];
            }
        } else {
            const topVilles = ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes"];
            const placeholders = topVilles.map(() => '?').join(',');
            officialRows = db.prepare(`
                SELECT * FROM elections_officiel_cache 
                WHERE election_slug = ? AND ville IN (${placeholders})
                ORDER BY ville, pct DESC
            `).all(electionSlug, ...topVilles) as any[];
        }

        const officialByVille: Record<string, Record<number, Candidat[]>> = {};
        const villeToDeps: Record<string, Set<string>> = {};

        for (const row of officialRows) {
            const key = `${row.ville}|${row.code_departement}`;
            if (!officialByVille[key]) officialByVille[key] = {};
            if (!officialByVille[key][row.tour]) officialByVille[key][row.tour] = [];

            if (!villeToDeps[row.ville]) villeToDeps[row.ville] = new Set();
            villeToDeps[row.ville].add(row.code_departement);

            officialByVille[key][row.tour].push({
                id: row.id,
                candidat: row.candidat,
                nuance: row.nuance || null,
                pct: row.pct,
                voix: row.voix || 0,
                statut: row.statut || 'elimine',
            });
        }

        // 4. Merge
        const finalByKey: Record<string, Record<number, Candidat[]>> = {};
        const localVilles = Object.keys(localByVille);

        // Pour le localByVille qui n'a pas forcément de dep, on tente de matcher ou on met '00'
        for (const v of localVilles) {
            // Si on a un targetedDep on l'utilise, sinon on crée une clé simple
            const key = targetedDep ? `${v}|${targetedDep}` : `${v}|LOCAL`;
            finalByKey[key] = localByVille[v];
        }

        for (const key of Object.keys(officialByVille)) {
            if (!finalByKey[key]) {
                finalByKey[key] = officialByVille[key];
            }
        }

        safeCloseDb(db);
        db = null;

        const results: VilleResult[] = Object.entries(finalByKey).map(([key, tours]) => {
            const [v, d] = key.split('|');
            // On affiche le département si on a plusieurs villes du même nom
            const displayName = (villeToDeps[v]?.size > 1 && d !== 'LOCAL') ? `${v} (${d})` : v;

            return {
                ville: displayName,
                tours: [1, 2].map(tourNum => {
                    const sorted = [...(tours[tourNum] || [])].sort((a, b) => b.pct - a.pct);
                    const processed = sorted.map((c, idx) => {
                        let s = c.statut || 'elimine';
                        if (tourNum === 1 && c.pct > 50) s = 'elu';
                        if (tourNum === 2 && idx === 0 && sorted.length > 0) s = 'elu';
                        return { ...c, statut: s };
                    });
                    return {
                        tour: tourNum,
                        candidats: processed,
                        hasData: !!(tours[tourNum]?.length),
                    };
                }),
            };
        });

        return NextResponse.json({
            success: true,
            updatedAt: new Date().toISOString(),
            results,
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        safeCloseDb(db);
    }
}

export async function POST(request: Request) {
    let db: any = null;
    try {
        const body = await request.json();
        const { election_slug = 'municipales-2026', ville, tour = 1, candidat, nuance, pct, voix, statut = 'elimine', active = 1 } = body;
        db = getDb();
        ensureTable(db);
        db.prepare(`
            INSERT INTO elections_resultats (election_slug, ville, tour, candidat, nuance, pct, voix, statut, active, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(election_slug, ville, tour, candidat)
            DO UPDATE SET nuance=excluded.nuance, pct=excluded.pct, voix=excluded.voix, statut=excluded.statut, active=excluded.active, updated_at=datetime('now')
        `).run(election_slug, ville, tour, candidat, nuance || null, pct, voix || 0, statut, active ? 1 : 0);
        safeCloseDb(db);
        db = null;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        safeCloseDb(db);
    }
}

export async function DELETE(request: Request) {
    let db: any = null;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        db = getDb();
        ensureTable(db);
        db.prepare('DELETE FROM elections_resultats WHERE id = ?').run(id);
        safeCloseDb(db);
        db = null;
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        safeCloseDb(db);
    }
}
