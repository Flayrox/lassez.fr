// lib/radar-config.ts

import { unstable_cache } from 'next/cache';
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

const RADAR_CONFIG_DEBUG =
    process.env.RADAR_CONFIG_DEBUG === 'true' || process.env.NODE_ENV !== 'production';

function logRadarConfig(message: string, payload?: unknown) {
    if (!RADAR_CONFIG_DEBUG) return;

    if (payload === undefined) {
        console.log(`[Radar Config] ${message}`);
        return;
    }

    console.log(`[Radar Config] ${message}`, payload);
}

function logRadarConfigError(message: string, payload?: unknown) {
    if (!RADAR_CONFIG_DEBUG) return;

    if (payload === undefined) {
        console.error(`[Radar Config] ${message}`);
        return;
    }

    console.error(`[Radar Config] ${message}`, payload);
}

const DEFAULT_CONFIG: RadarConfig = {
    maintenance_mode: false,
    maintenance_message: '',
    popup_enabled: false,
    popup_title: '',
    popup_text: '',
    popup_link_url: '',
    popup_link_label: ''
};

export async function getRadarConfig(): Promise<RadarConfig> {
    const remoteUrl = process.env.RADAR_API_URL;
    let configUrl = '';
    
    if (remoteUrl) {
        // On déduit l'URL de config de l'URL de nav
        configUrl = remoteUrl.replace('/nav', '/config');
    }

    const loadConfig = unstable_cache(
        async () => {
            // 1. Check if we should use the Remote API (Hostinger case)
            if (configUrl && !process.env.IS_STUDIO) {
                try {
                    logRadarConfig(`Fetching config from: ${configUrl}`);
                    const res = await fetch(configUrl, {
                        next: { revalidate: 300, tags: ['radar-config'] }
                    });

                    if (res.ok) {
                        const data = await res.json();
                        logRadarConfig('Received config:', data.config);
                        if (data.success && data.config) {
                            return data.config as RadarConfig;
                        }
                    } else {
                        logRadarConfig(`Fetch remote config failed with status: ${res.status}, falling back to local DB...`);
                    }
                } catch (error) {
                    logRadarConfig(`Fetch remote config error: ${error}, falling back to local DB...`);
                }
            }

            // 2. Local SQLite Logic (Hetzner Studio case / Fallback)
            try {
                const dbPath = path.join(process.cwd(), 'radar_lassez', 'radar.db');
                const db = new Database(dbPath);

                const rows = db.prepare(`
                    SELECT key, value FROM radar_settings 
                    WHERE key IN (
                        'maintenance_mode', 'maintenance_message',
                        'popup_enabled', 'popup_title', 'popup_text', 'popup_link_url', 'popup_link_label'
                    )
                `).all();

                const localConfig: Record<string, string> = {};
                for (const row of rows as { key: string; value: string }[]) {
                    localConfig[row.key] = row.value;
                }
                
                db.close();

                return {
                    maintenance_mode: localConfig.maintenance_mode === 'true',
                    maintenance_message: localConfig.maintenance_message || '',
                    popup_enabled: localConfig.popup_enabled === 'true',
                    popup_title: localConfig.popup_title || '',
                    popup_text: localConfig.popup_text || '',
                    popup_link_url: localConfig.popup_link_url || '',
                    popup_link_label: localConfig.popup_link_label || ''
                } as RadarConfig;
            } catch (error) {
                logRadarConfigError('Local DB query error:', error);
            }

            return DEFAULT_CONFIG;
        },
        ['radar-config'],
        { revalidate: 300, tags: ['radar-config'] }
    );

    return loadConfig();
}
