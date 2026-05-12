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
        if (settings.pipelineGraphJson && settings.pipelineGraphJson !== '{}' && settings.pipelineGraphJson !== '[]') {
            try {
                const graph = JSON.parse(settings.pipelineGraphJson);
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
                // console.error(`[ConfigResolver] Erreur de parsing du graphe pour ${nodeType}:${key}`, e);
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
