import Database from 'better-sqlite3';
import path from 'path';

export interface RadarConfig {
    maintenance_mode: boolean;
    maintenance_message: string;
    popup_enabled: boolean;
    popup_title: string;
    popup_text: string;
    popup_link_url: string;
    popup_link_label: string;
}

export const DEFAULT_RADAR_CONFIG: RadarConfig = {
    maintenance_mode: false,
    maintenance_message: '',
    popup_enabled: false,
    popup_title: '',
    popup_text: '',
    popup_link_url: '',
    popup_link_label: '',
};

function getDb() {
    const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
    return new Database(dbPath, { readonly: true });
}

export function readRadarPublicConfigFromDb(): RadarConfig {
    let db: Database.Database | null = null;
    try {
        db = getDb();
        const rows = db
            .prepare(
                `
                SELECT key, value FROM radar_settings
                WHERE key IN (
                    'maintenance_mode',
                    'maintenance_message',
                    'popup_enabled',
                    'popup_title',
                    'popup_text',
                    'popup_link_url',
                    'popup_link_label'
                )
                `
            )
            .all() as Array<{ key: string; value: string }>;

        const configMap: Record<string, string> = {};
        for (const row of rows) configMap[row.key] = row.value;

        return {
            maintenance_mode: configMap.maintenance_mode === 'true',
            maintenance_message: configMap.maintenance_message || '',
            popup_enabled: configMap.popup_enabled === 'true',
            popup_title: configMap.popup_title || '',
            popup_text: configMap.popup_text || '',
            popup_link_url: configMap.popup_link_url || '',
            popup_link_label: configMap.popup_link_label || '',
        };
    } catch {
        return DEFAULT_RADAR_CONFIG;
    } finally {
        if (db) db.close();
    }
}