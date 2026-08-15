import path from 'path';

/**
 * Chemin de la base SQLite legacy (élections, config, nav, social).
 *
 * Elle a été déplacée de radar_lassez/ vers data/ pour que le daemon TS
 * (supprimé) n'héberge plus de données du front. Non versionnée (gitignorée).
 */
export function getRadarDbPath(): string {
    return path.join(process.cwd(), 'data', 'radar.db');
}

/** Dossier temporaire partagé (images du studio, etc.). */
export function getDataTmpDir(): string {
    return path.join(process.cwd(), 'data', 'tmp');
}
