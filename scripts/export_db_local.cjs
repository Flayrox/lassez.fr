#!/usr/bin/env node
/**
 * Export local de la base de données L'Assez (Supabase Postgres).
 *
 * Produit, dans data/db-export-<date>/ :
 *   - lassez-full.sql        : dump SQL complet (schéma + données, tous les schémas),
 *                              ré-importable avec psql.
 *   - lassez-full.sql.gz     : version compressée du dump.
 *   - lassez-explore.sql     : SQL intermédiaire (CREATE TABLE + INSERT) pour SQLite.
 *   - lassez-explore.sqlite  : copie explorable en SQLite (sqlite3, SQLite Browser, DBeaver…).
 *   - README.md              : guide d'exploration.
 *
 * Usage : node scripts/export_db_local.cjs [--out <dossier>]
 * La DATABASE_URL est lue dans .env. Dépendances : pg (déjà dans node_modules)
 * et le binaire sqlite3 (présent sur macOS) OU le binaire pg_dump/libpq.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');

function readDbUrl() {
  const envPath = path.join(ROOT, '.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  if (!line) throw new Error('DATABASE_URL introuvable dans .env');
  return line.slice('DATABASE_URL='.length).trim();
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Les schémas système de Postgres / Supabase qu'on ne copie pas. */
const SKIP_SCHEMAS = new Set(['pg_catalog', 'information_schema', 'pg_toast', 'extensions']);

/** Mapping des types Postgres → types SQLite pour la copie d'exploration. */
function sqliteType(pgType) {
  const t = (pgType || '').toLowerCase();
  if (t.includes('int')) return 'INTEGER';
  if (t === 'numeric' || t === 'real' || t === 'double precision' || t === 'money') return 'REAL';
  if (t === 'boolean') return 'INTEGER';
  if (t === 'bytea') return 'BLOB';
  return 'TEXT';
}

/** Échappe un littéral SQL (doubles quotes SQLite) en gérant chaque type de valeur. */
function sqlLiteral(v, pgType) {
  if (v === null || v === undefined) return 'NULL';
  if (Buffer.isBuffer(v)) return `X'${v.toString('hex')}'`; // bytea → BLOB
  if (v instanceof Date) return `'${v.toISOString()}'`;
  const t = (pgType || '').toLowerCase();
  if (t === 'boolean') return v ? '1' : '0';
  if (t.includes('int')) {
    // bigint arrive en string du driver pg
    return /^-?\d+$/.test(String(v)) ? String(v) : `'${String(v).replace(/'/g, "''")}'`;
  }
  if (t === 'numeric' || t === 'real' || t === 'double precision' || t === 'money') {
    return typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v))
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;
  }
  let s;
  if (typeof v === 'object') s = JSON.stringify(v); // jsonb, tableaux…
  else s = String(v);
  return `'${s.replace(/'/g, "''")}'`;
}

async function listTables(client) {
  const res = await client.query(`
    SELECT n.nspname AS schema, c.relname AS table_name,
           pg_total_relation_size(c.oid) AS bytes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r' AND NOT c.relispartition
      AND n.nspname <> ALL($1::text[])
    ORDER BY n.nspname, c.relname
  `, [[...SKIP_SCHEMAS]]);
  return res.rows;
}

async function tableColumns(client, schema, table) {
  const res = await client.query(`
    SELECT column_name, data_type, udt_name, is_nullable
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `, [schema, table]);
  return res.rows;
}

async function main() {
  const outArg = process.argv.indexOf('--out');
  const outDir = outArg !== -1
    ? path.resolve(process.argv[outArg + 1])
    : path.join(ROOT, 'data', `db-export-${isoDate()}`);

  fs.mkdirSync(outDir, { recursive: true });
  const dbUrl = readDbUrl();

  console.log(`→ Dossier d'export : ${outDir}`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  // 1) Dump SQL complet via pg_dump (libpq)
  const pgDump = process.env.PGDUMP || '/opt/homebrew/opt/libpq/bin/pg_dump';
  const sqlPath = path.join(outDir, 'lassez-full.sql');
  console.log('→ pg_dump du schéma + données (tous les schémas)…');
  try {
    execFileSync(pgDump, [
      dbUrl,
      '--format=plain',
      '--no-owner',
      '--no-privileges',
      `--file=${sqlPath}`,
    ], { stdio: 'inherit' });
    execFileSync('gzip', ['-k', '-f', sqlPath], { stdio: 'inherit' });
    console.log(`  ✓ lassez-full.sql (${(fs.statSync(sqlPath).size / 1024 / 1024).toFixed(2)} Mo) + .gz`);
  } catch (e) {
    console.warn(`  ⚠ pg_dump indisponible (${e.message.split('\n')[0]}) — on continue avec la copie SQLite seule.`);
  }

  // 2) Génération du SQL SQLite (CREATE TABLE + INSERT) puis build via sqlite3 CLI
  const tables = await listTables(client);
  const sqliteSql = path.join(outDir, 'lassez-explore.sql');
  const sqlitePath = path.join(outDir, 'lassez-explore.sqlite');

  console.log('→ Génération de la copie SQLite…');
  const out = fs.createWriteStream(sqliteSql);

  const w = (s) => out.write(s + '\n');
  w('PRAGMA journal_mode = OFF;');
  w('PRAGMA synchronous = OFF;');
  w('BEGIN;');
  w('CREATE TABLE __meta_export (key TEXT PRIMARY KEY, value TEXT);');
  w(`INSERT INTO __meta_export VALUES ('exported_at', '${isoDate()}');`);
  w('CREATE TABLE __meta_tables (schema_name TEXT, table_name TEXT, pg_columns TEXT, row_count INTEGER);');

  let totalRows = 0;

  for (const { schema, table_name } of tables) {
    const cols = await tableColumns(client, schema, table_name);
    const qTable = `"${schema}__${table_name}"`;
    const quoted = cols.map((c) => `"${c.column_name}"`);
    w(`CREATE TABLE ${qTable} (${cols
      .map((c) => `"${c.column_name}" ${sqliteType(c.data_type)}`)
      .join(', ')});`);

    const { rows: [cnt] } = await client.query(
      `SELECT count(*)::int AS n FROM "${schema}"."${table_name}"`,
    );
    const n = cnt.n;

    if (n > 0) {
      const cur = await client.query({
        text: `SELECT * FROM "${schema}"."${table_name}"`,
        rowMode: 'array',
      });
      const rows = cur.rows;
      const batch = [];
      for (const row of rows) {
        batch.push(`(${row.map((v, i) => sqlLiteral(v, cols[i].data_type)).join(', ')})`);
        if (batch.length >= 500) {
          w(`INSERT INTO ${qTable} (${quoted.join(', ')}) VALUES\n${batch.join(',\n')};`);
          batch.length = 0;
        }
      }
      if (batch.length) {
        w(`INSERT INTO ${qTable} (${quoted.join(', ')}) VALUES\n${batch.join(',\n')};`);
      }
      totalRows += rows.length;
    }

    w(`INSERT INTO __meta_tables VALUES ('${schema}', '${table_name}', '${JSON.stringify(cols.map((c) => ({
      name: c.column_name,
      type: c.data_type,
      udt: c.udt_name,
      nullable: c.is_nullable === 'YES',
    }))).replace(/'/g, "''")}', ${n});`);
    console.log(`  ✓ ${schema}.${table_name} (${n} lignes)`);
  }

  w('COMMIT;');
  await new Promise((resolve, reject) => {
    out.end((err) => (err ? reject(err) : resolve()));
  });

  console.log('→ Construction de lassez-explore.sqlite avec sqlite3…');
  execFileSync('/usr/bin/sqlite3', [sqlitePath], {
    input: fs.readFileSync(sqliteSql, 'utf8'),
    stdio: ['pipe', 'inherit', 'inherit'],
  });

  // 3) Vérification des comptages
  console.log('→ Vérification des comptages…');
  const check = execFileSync('/usr/bin/sqlite3', [sqlitePath, `
    SELECT 'OK' AS status, count(*) AS n FROM __meta_tables;
  `]).toString().trim();
  console.log(`  ✓ ${check}`);

  await client.end();

  console.log(`\n✓ ${sqlitePath} (${(fs.statSync(sqlitePath).size / 1024 / 1024).toFixed(2)} Mo, ${totalRows} lignes au total)`);

  // 4) README
  const readme = `# Export local de la base L'Assez — ${isoDate()}

Export complet de la base Supabase (Postgres) de L'Assez, réalisé par
\`node scripts/export_db_local.cjs\` (relançable à tout moment pour rafraîchir).

## Contenu

| Fichier | Description |
|---|---|
| \`lassez-full.sql\` | Dump SQL complet (schéma + données, tous les schémas : \`public\`, \`auth\`, \`storage\`, \`realtime\`, \`vault\`). Ré-importable : \`psql "$DATABASE_URL" < lassez-full.sql\`. |
| \`lassez-full.sql.gz\` | Version compressée (gzip) du dump. |
| \`lassez-explore.sql\` | SQL intermédiaire (CREATE TABLE + INSERT) utilisé pour construire la copie SQLite. |
| \`lassez-explore.sqlite\` | Copie explorable en SQLite (lecture directe, sans serveur). |

## Explorer la copie SQLite

\`\`\`bash
sqlite3 data/db-export-${isoDate()}/lassez-explore.sqlite
\`\`\`

Les tables sont préfixées par leur schéma d'origine : \`public__revelations\`,
\`public__signals\`, \`auth__users\`, \`storage__objects\`, etc.

\`\`\`sql
.tables
SELECT count(*) FROM public__revelations;
SELECT title, _status, updated_at FROM public__revelations ORDER BY updated_at DESC LIMIT 10;
\`\`\`

- \`__meta_export\` : date d'export, source.
- \`__meta_tables\` : pour chaque table, les colonnes et types PostgreSQL d'origine
  (JSON) et le nombre de lignes.

Outils possibles : \`sqlite3\` en CLI, [DB Browser for SQLite](https://sqlitebrowser.org/),
DBeaver, ou n'importe quel client SQLite.

## Notes

- Les types PostgreSQL (JSONB, tableaux, timestamps…) sont traduits en TEXT/INTEGER/REAL/BLOB
  pour SQLite ; le schéma PostgreSQL d'origine est conservé dans \`__meta_tables\`.
- Le dump SQL (\`lassez-full.sql\`) reste la référence exacte : il contient le schéma
  PostgreSQL réel (types, contraintes, index, RLS, etc.) et toutes les données.
- Secrets : ce dossier contient des données réelles (utilisateurs, sessions…) — ne pas
  committer ni partager.
`;
  fs.writeFileSync(path.join(outDir, 'README.md'), readme);
  console.log(`✓ README.md écrit (${outDir})`);
}

main().catch((e) => {
  console.error('Erreur :', e);
  process.exit(1);
});
