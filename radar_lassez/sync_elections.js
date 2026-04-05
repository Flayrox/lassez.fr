
import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import csvParser from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'radar.db');
const db = new Database(dbPath);

console.log(`[${new Date().toISOString()}] Début de la synchronisation des élections...`);

function ensureTable() {
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
        
        CREATE TABLE IF NOT EXISTS elections_sync_status (
            election_slug TEXT PRIMARY KEY,
            last_sync TEXT
        );
    `);
}

async function fetchAndStreamCsv(url, onRow) {
    return new Promise((resolve, reject) => {
        let count = 0;
        https.get(url, (res) => {
            if (res.statusCode !== 200) return reject(new Error(`Status ${res.statusCode} for ${url}`));
            res.pipe(csvParser({ separator: ';' }))
                .on('data', (row) => onRow(row, count++))
                .on('end', () => resolve(count))
                .on('error', reject);
        }).on('error', reject);
    });
}

async function sync() {
    const electionSlug = 'municipales-2026';
    ensureTable();

    const getLatestCsv = async (datasetSlug, keyword) => {
        const fetchRes = await fetch(`https://www.data.gouv.fr/api/1/datasets/${datasetSlug}/`);
        if (!fetchRes.ok) return null;
        const data = await fetchRes.json();
        const resources = (data.resources || []).filter((r) => {
            const title = r.title ? r.title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';
            return r.format?.toLowerCase() === 'csv' && title.includes(keyword) && !title.includes('bv') && !title.includes('polynesie');
        });
        if (resources.length === 0) return null;
        resources.sort((a, b) => new Date(b.last_modified).getTime() - new Date(a.last_modified).getTime());
        return resources[0].url;
    };

    const firstTourResultsUrl = await getLatestCsv('elections-municipales-2026-resultats-du-premier-tour', 'communes');
    const secondTourResultsUrl = await getLatestCsv('elections-municipales-2026-resultats-du-second-tour', 'communes');
    const candidatures1Url = await getLatestCsv('elections-municipales-2026-listes-candidates-au-premier-tour', 'candidatures');
    const candidatures2Url = await getLatestCsv('elections-municipales-2026-listes-candidates-au-second-tour', 'candidatures');

    const candidatesMap = {};
    const indexCandidatures = async (url) => {
        if (!url) return;
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
                    candidatesMap[key] = { tete: `${prenom} ${nom}`.trim(), nuanceLabel: nuance };
                }
            }
        });
    };

    await indexCandidatures(candidatures1Url);
    await indexCandidatures(candidatures2Url);

    db.prepare('DELETE FROM elections_officiel_cache WHERE election_slug = ?').run(electionSlug);
    const insertStmt = db.prepare(`
        INSERT INTO elections_officiel_cache (election_slug, code_departement, code_insee, ville, ville_norm, tour, candidat, nuance, pct, voix, statut)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let buffer = [];
    const transaction = db.transaction((rows) => {
        for (const row of rows) insertStmt.run(row);
    });

    const processResults = async (url, tourNum) => {
        if (!url) return;
        console.log(`Processing Tour ${tourNum}...`);
        await fetchAndStreamCsv(url, (row) => {
            const ville = row['Libellé commune'] || row['Libellé de la commune'];
            let dep = (row['Code département'] || row['Code du département'] || row['CODDPT'] || '').toString().trim();
            let com = (row['Code commune'] || row['Code de la commune'] || row['CODCOM'] || '').toString().trim();
            if (dep.length === 1) dep = '0' + dep;
            if (com.length === 1) com = '00' + com;
            if (com.length === 2) com = '0' + com;
            if (!ville) return;
            const villeKey = `${dep}|${ville.trim().toUpperCase()}`;
            for (let j = 1; j <= 40; j++) {
                const voixStr = row[`Voix ${j}`];
                if (voixStr === undefined || voixStr === '') continue;
                const nomRes = row[`Nom candidat ${j}`] || '';
                const prenomRes = row[`Prénom candidat ${j}`] || '';
                const listeRes = row[`Libellé de liste ${j}`] || row[`Libellé abrégé de liste ${j}`] || '';
                const mapInfo = candidatesMap[`${villeKey}|${listeRes.trim().toUpperCase()}`];
                let candidatFinal = (mapInfo && mapInfo.tete) ? `${mapInfo.tete} (${listeRes})` : (nomRes ? `${prenomRes} ${nomRes}`.trim() : listeRes);
                if (!candidatFinal) continue;
                const pct = parseFloat((row[`% Voix/exprimés ${j}`] || '0').replace(',', '.').replace('%', '')) || 0;
                const nuance = row[`Nuance liste ${j}`] || (mapInfo?.nuanceLabel) || null;
                const elu = row[`Elu ${j}`]?.toLowerCase() === 'oui' ? 'elu' : (pct > 10 ? 'qualifie' : 'elimine');
                const villeNorm = ville.normalize("NFD").toLowerCase().replace(/[^a-z0-9]/g, "");
                buffer.push([electionSlug, dep, dep + com, ville, villeNorm, tourNum, candidatFinal, nuance, pct, parseInt(voixStr, 10), elu]);
                if (buffer.length >= 500) { transaction(buffer); buffer = []; }
            }
        });
    };

    if (firstTourResultsUrl) await processResults(firstTourResultsUrl, 1);
    if (secondTourResultsUrl) await processResults(secondTourResultsUrl, 2);
    if (buffer.length > 0) transaction(buffer);

    db.prepare('INSERT OR REPLACE INTO elections_sync_status (election_slug, last_sync) VALUES (?, ?)').run(electionSlug, new Date().toISOString());
    console.log('Sync terminée.');
}

sync().catch(console.error).finally(() => db.close());
