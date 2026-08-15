import { payloadClient } from './payload-client';

let cachedSettings: any | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30 * 1000;

/**
 * Résout un paramètre de configuration en suivant la cascade :
 * 1. Node local (dans le pipelineGraphJson)
 * 2. Réglage Global (global Payload radar-settings)
 * 3. Valeur par défaut fournie
 */
export async function getEffectiveParam(nodeType: string, key: string, defaultValue: any = null) {
    try {
        const settings = await getSettingsCached();
        if (!settings) return defaultValue;

        // 1. Tenter de trouver une surcharge dans le graphe du Flow
        if (settings.pipelineGraphJson && settings.pipelineGraphJson.trim() !== '' && settings.pipelineGraphJson !== '{}' && settings.pipelineGraphJson !== '[]') {
            try {
                const graph = typeof settings.pipelineGraphJson === 'string' ? JSON.parse(settings.pipelineGraphJson) : settings.pipelineGraphJson;
                // Sécurité : vérifier que graph et graph.nodes existent avant .find
                if (graph && Array.isArray(graph.nodes)) {
                    const node = graph.nodes.find((n: any) => n.type === nodeType);
                    if (node && Array.isArray(node.settings)) {
                        const localSetting = node.settings.find((s: any) => s.key === key);
                        if (localSetting && localSetting.value !== undefined && localSetting.value !== '') {
                            return localSetting.value;
                        }
                    }
                }
            } catch (e) {
                // Silencieux : si le graphe est corrompu on utilise juste les réglages globaux
            }
        }

        // 2. Tomber sur le réglage global (mêmes noms de clés que l'ancien modèle Prisma)
        const globalValue = (settings as any)[key];
        if (globalValue !== undefined && globalValue !== null && globalValue !== '') {
            return globalValue;
        }

        return defaultValue;
    } catch (error) {
        console.error(`[ConfigResolver] Erreur lors de la résolution de ${key}:`, error);
        return defaultValue;
    }
}

export async function getSettingsCached(): Promise<any | null> {
    const now = Date.now();
    if (cachedSettings && now < cacheExpiresAt) return cachedSettings;

    const settings = await payloadClient.getSettings();
    if (settings) {
        cachedSettings = settings;
        cacheExpiresAt = now + CACHE_TTL_MS;
    }
    return settings;
}

export function invalidateSettingsCache() {
    cachedSettings = null;
    cacheExpiresAt = 0;
}
