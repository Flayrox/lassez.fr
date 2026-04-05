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
        // En mode Studio, on pourrait lire la DB, mais pour simplifier 
        // et rester cohérent entre les deux serveurs, on passe par l'API interne/externe.
        const res = await fetch(configUrl, {
            next: { revalidate: 30 } // Cache de 30 secondes
        });

        if (res.ok) {
            const data = await res.json();
            if (data.success && data.config) {
                return data.config;
            }
        }
    } catch (error) {
        console.error('Failed to fetch radar config:', error);
    }

    return DEFAULT_CONFIG;
}
