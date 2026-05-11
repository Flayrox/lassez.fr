import { prisma } from './prisma';

/**
 * Résout un paramètre de configuration en suivant la cascade :
 * 1. Node local (dans le pipelineGraphJson)
 * 2. Réglage Global (table GlobalSettings)
 * 3. Valeur par défaut fournie
 */
export async function getEffectiveParam(nodeType: string, key: string, defaultValue: any = null) {
    try {
        const settings = await prisma.globalSettings.findFirst();
        if (!settings) return defaultValue;

        // 1. Tenter de trouver une surcharge dans le graphe du Flow
        if (settings.pipelineGraphJson) {
            try {
                const graph = JSON.parse(settings.pipelineGraphJson);
                const node = graph.nodes?.find((n: any) => n.type === nodeType);
                const localSetting = node?.settings?.find((s: any) => s.key === key);
                
                if (localSetting && localSetting.value !== undefined && localSetting.value !== '') {
                    return localSetting.value;
                }
            } catch (e) {
                console.error(`[ConfigResolver] Erreur de parsing du graphe pour ${nodeType}:${key}`, e);
            }
        }

        // 2. Tomber sur le réglage global (mapping des clés Prisma)
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
