// lib/radar-config.ts

export interface RadarConfig {
    maintenance_mode: boolean;
    maintenance_message: string;
    popup_enabled: boolean;
    popup_title: string;
    popup_text: string;
    popup_link_url: string;
    popup_link_label: string;
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

    try {
        console.log(`[Radar Config] Fetching config from: ${configUrl}`);
        const res = await fetch(configUrl, {
            next: {
                revalidate: 300,
                tags: ['radar-config']
            }
        });

        if (res.ok) {
            const data = await res.json();
            console.log(`[Radar Config] Received config:`, data.config);
            if (data.success && data.config) {
                return data.config;
            }
        } else {
            console.error(`[Radar Config] Fetch failed with status: ${res.status}`);
        }
    } catch (error) {
        console.error('[Radar Config] Fetch error:', error);
    }

    return DEFAULT_CONFIG;
}
