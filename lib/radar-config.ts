// lib/radar-config.ts

import { unstable_cache } from 'next/cache';

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
    const remoteUrl = process.env.RADAR_API_URL || 'https://studio.lassez.fr/api/radar/nav';
    // On déduit l'URL de config de l'URL de nav
    const configUrl = remoteUrl.replace('/nav', '/config');

    const loadConfig = unstable_cache(
        async () => {
            try {
                logRadarConfig(`Fetching config from: ${configUrl}`);
                const res = await fetch(configUrl, {
                    next: {
                        revalidate: 300,
                        tags: ['radar-config']
                    }
                });

                if (res.ok) {
                    const data = await res.json();
                    logRadarConfig('Received config:', data.config);
                    if (data.success && data.config) {
                        return data.config as RadarConfig;
                    }
                } else {
                    logRadarConfigError(`Fetch failed with status: ${res.status}`);
                }
            } catch (error) {
                logRadarConfigError('Fetch error:', error);
            }

            return DEFAULT_CONFIG;
        },
        ['radar-config'],
        { revalidate: 300, tags: ['radar-config'] }
    );

    return loadConfig();
}
