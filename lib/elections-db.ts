import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';

// ── Bases par élection ──────────────────────────────────────────────────────
// Depuis le refactor des bases : UN fichier SQLite par élection
// (data/elections/{slug}.db), séparé de la base du pipeline (data/radar.db).
// Un nouveau scrutin = un nouveau fichier, rien à mélanger avec les signaux.

export function getElectionsDir(): string {
    return path.join(process.cwd(), 'data', 'elections');
}

export function getElectionDbPath(slug: string): string {
    const safe = String(slug || '').replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
    return path.join(getElectionsDir(), `${safe || 'election'}.db`);
}

// ── Registre global (quelles élections afficher + la cible) ─────────────────
// Le registre liste les scrutins disponibles (un fichier par élection) et
// celui qui est la cible d'analyse. Stocké en JSON, créé par la migration.

export interface ElectionsRegistry {
    displaySlugs: string[];
    targetSlug: string;
}

export function getElectionsRegistryPath(): string {
    return path.join(getElectionsDir(), 'registry.json');
}

const DEFAULT_REGISTRY: ElectionsRegistry = {
    displaySlugs: ['municipales-2026'],
    targetSlug: 'municipales-2026',
};

export function readElectionsRegistry(): ElectionsRegistry {
    try {
        const raw = fs.readFileSync(getElectionsRegistryPath(), 'utf-8');
        const parsed = JSON.parse(raw);
        const displaySlugs = Array.isArray(parsed?.displaySlugs)
            ? parsed.displaySlugs.map((v: unknown) => String(v)).filter(Boolean)
            : [];
        const targetSlug = String(parsed?.targetSlug || '');
        if (!displaySlugs.length) return DEFAULT_REGISTRY;
        return {
            displaySlugs,
            targetSlug: targetSlug || displaySlugs[0],
        };
    } catch {
        return DEFAULT_REGISTRY;
    }
}

export function writeElectionsRegistry(registry: ElectionsRegistry) {
    fs.mkdirSync(getElectionsDir(), { recursive: true });
    fs.writeFileSync(getElectionsRegistryPath(), JSON.stringify(registry, null, 2), 'utf-8');
}

// ── Ouverture d'une base élection ────────────────────────────────────────────
// Crée le dossier si besoin (la route de sync peut créer une élection à la
// volée). Le schéma (tables officiel_cache / resultats / sync_status) est
// garanti par ensureElectionSchema côté route.

export function openElectionDb(slug: string, options: { readonly?: boolean } = {}): Database.Database {
    fs.mkdirSync(getElectionsDir(), { recursive: true });
    return new Database(getElectionDbPath(slug), options.readonly ? { readonly: true } : {});
}
