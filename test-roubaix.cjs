const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
const db = new Database(dbPath, { readonly: true });

const slug = '5959512-roubaix';
const codeInsee = slug.split('-')[0];

const allRows = db.prepare(`
  SELECT * 
  FROM elections_officiel_cache 
  WHERE code_insee = ? AND election_slug = 'municipales-2026'
  ORDER BY tour, pct DESC
`).all(codeInsee);

let cityData = allRows[0];
const deptCommunes = db.prepare(`
  SELECT DISTINCT code_insee, ville 
  FROM elections_officiel_cache 
  WHERE code_departement = ? AND election_slug = 'municipales-2026'
  ORDER BY ville
`).all(cityData.code_departement);

console.log("Found rows for city:", allRows.length);
console.log("Dept communes:", deptCommunes.length);

const toursData = [1, 2].map(t => {
  const rawCands = allRows.filter(r => r.tour === t).map(r => ({
    id: r.id,
    candidat: r.candidat,
    nuance: r.nuance,
    pct: r.pct,
    voix: r.voix,
    statut: r.statut || 'elimine'
  }));

  const candidats = rawCands.sort((a, b) => b.pct - a.pct).map((c, idx) => {
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

// Import semantic summary to test it
const fs = require('fs');
const tsCode = fs.readFileSync(path.join(process.cwd(), 'lib', 'seo-engine.ts'), 'utf8');
// Compile ts string or just run a simplified version:

const results = toursData.find(t => t.hasData)?.candidats || [];
const sortedResults = [...results].sort((a, b) => (b.pourcentage || 0) - (a.pourcentage || 0));
const winner = sortedResults[0];
const runnerUp = sortedResults[1];

let summary;
if (!results || !Array.isArray(results) || results.length === 0) {
  summary = `empty`;
} else {
  const templates = [
    () => `À ${cityData.ville} (Nord), les résultats des élections municipales placent la liste de ${winner.candidat} en tête du scrutin avec ${winner.pourcentage}% des voix.`
  ];
  summary = templates[0]();
}

console.log("Summary:", summary);
