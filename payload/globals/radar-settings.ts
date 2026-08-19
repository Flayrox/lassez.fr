import type { GlobalConfig } from 'payload';
import { isAdmin } from '../access';

const PUBLISH_MODES = [
    { label: 'Direct', value: 'DIRECT' },
    { label: 'Planifié', value: 'SCHEDULED' },
];

const SCHEDULING_MODES = [
    { label: 'Pulse', value: 'pulse' },
    { label: 'Calendrier', value: 'calendar' },
    { label: 'Hybride', value: 'hybrid' },
];

const DEFAULT_AVAILABLE_MODELS = JSON.stringify([
    { value: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (par défaut)' },
    { value: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
    { value: 'gemini-3.7-flash', label: 'Gemini 3.7 Flash' },
    { value: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash-Lite (stable)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
]);

const SECRET_HINT = 'Secret — laisser vide pour conserver la valeur actuelle.';

/**
 * Hook d'écriture seule : sur une mise à jour, une valeur vide (ou absente)
 * conserve le secret déjà stocké au lieu de l'écraser. Empêche la sauvegarde
 * du formulaire d'admin d'effacer accidentellement une clé.
 */
const keepExistingSecret = (fieldName: string) => ({
    beforeChange: [
        ({ value, originalDoc, operation }: any) => {
            if (operation === 'update' && (value === undefined || value === null || value === '')) {
                return originalDoc?.[fieldName];
            }
            return value;
        },
    ],
});

/** Champ secret : texte simple + hook d'écriture seule. */
const secretField = (name: string, label: string, width?: string) => ({
    name,
    type: 'text' as const,
    label,
    admin: {
        ...(width ? { width } : {}),
        autoComplete: 'off',
        description: SECRET_HINT,
    },
    hooks: keepExistingSecret(name),
});

/**
 * Radar Settings — configuration globale du daemon (ex table Prisma GlobalSettings).
 * Singleton Payload : une seule instance, éditée depuis l'interface admin unifiée.
 * Chaque plateforme de diffusion est un bloc collapsible autonome (activation,
 * mode, limites, credentials) — ajouter un canal = un bloc, rien d'autre.
 */
export const radarSettings: GlobalConfig = {
    slug: 'radar-settings',
    label: 'Réglages de la veille',
    access: {
        read: isAdmin,
        update: isAdmin,
    },
    admin: {
        group: 'Investigation',
        description: 'Configuration globale de la veille (sources, IA, diffusion, planification).',
    },
    fields: [
        {
            type: 'tabs',
            tabs: [
                {
                    label: 'Diffusion',
                    fields: [
                        {
                            type: 'row',
                            fields: [
                                { name: 'enableAutoPublish', type: 'checkbox', defaultValue: true, label: 'Auto-publication', admin: { width: '50%' } },
                                { name: 'enablePayloadCMS', type: 'checkbox', defaultValue: true, label: 'Payload CMS', admin: { width: '50%' } },
                            ],
                        },
                        {
                            name: 'includeSourceUrl',
                            type: 'checkbox',
                            defaultValue: true,
                            label: 'Ajouter le lien source dans les posts sociaux',
                        },
                        {
                            type: 'collapsible',
                            label: 'Discord',
                            admin: { initCollapsed: true },
                            fields: [
                                { name: 'enableDiscord', type: 'checkbox', defaultValue: true, label: 'Activer Discord' },
                                {
                                    type: 'row',
                                    fields: [
                                        { name: 'discordPublishMode', type: 'select', defaultValue: 'DIRECT', options: PUBLISH_MODES, label: 'Mode', admin: { width: '50%' } },
                                        { name: 'discordEmbedColor', type: 'text', defaultValue: '#DC2626', label: 'Couleur embed (hex)', admin: { width: '50%' } },
                                    ],
                                },
                                { name: 'discordFooterText', type: 'text', defaultValue: "Radar L'Assez • Investigation", label: 'Footer embed' },
                                secretField('discordWebhookUrl', 'Webhook Discord'),
                            ],
                        },
                        {
                            type: 'collapsible',
                            label: 'X / Twitter',
                            admin: { initCollapsed: true },
                            fields: [
                                { name: 'enableX', type: 'checkbox', defaultValue: false, label: 'Activer X / Twitter' },
                                {
                                    type: 'row',
                                    fields: [
                                        { name: 'xPublishMode', type: 'select', defaultValue: 'SCHEDULED', options: PUBLISH_MODES, label: 'Mode', admin: { width: '50%' } },
                                        { name: 'xMaxLength', type: 'number', defaultValue: 280, label: 'Limite (car.)', admin: { width: '50%' } },
                                    ],
                                },
                                {
                                    type: 'row',
                                    fields: [
                                        secretField('xApiKey', 'API Key', '50%'),
                                        secretField('xApiSecret', 'API Secret', '50%'),
                                    ],
                                },
                                {
                                    type: 'row',
                                    fields: [
                                        secretField('xAccessToken', 'Access Token', '50%'),
                                        secretField('xAccessSecret', 'Access Secret', '50%'),
                                    ],
                                },
                            ],
                        },
                        {
                            type: 'collapsible',
                            label: 'Bluesky',
                            admin: { initCollapsed: true },
                            fields: [
                                { name: 'enableBluesky', type: 'checkbox', defaultValue: false, label: 'Activer Bluesky' },
                                {
                                    type: 'row',
                                    fields: [
                                        { name: 'blueskyPublishMode', type: 'select', defaultValue: 'SCHEDULED', options: PUBLISH_MODES, label: 'Mode', admin: { width: '50%' } },
                                        { name: 'blueskyMaxLength', type: 'number', defaultValue: 300, label: 'Limite (car.)', admin: { width: '50%' } },
                                    ],
                                },
                                {
                                    type: 'row',
                                    fields: [
                                        secretField('blueskyIdentifier', 'Identifiant (handle)', '50%'),
                                        secretField('blueskyAppPassword', 'Mot de passe app', '50%'),
                                    ],
                                },
                            ],
                        },
                        {
                            type: 'collapsible',
                            label: 'Mastodon',
                            admin: { initCollapsed: true },
                            fields: [
                                { name: 'enableMastodon', type: 'checkbox', defaultValue: false, label: 'Activer Mastodon' },
                                {
                                    type: 'row',
                                    fields: [
                                        { name: 'mastodonPublishMode', type: 'select', defaultValue: 'SCHEDULED', options: PUBLISH_MODES, label: 'Mode', admin: { width: '50%' } },
                                        { name: 'mastodonMaxLength', type: 'number', defaultValue: 500, label: 'Limite (car.)', admin: { width: '50%' } },
                                    ],
                                },
                                {
                                    type: 'row',
                                    fields: [
                                        secretField('mastodonInstanceUrl', 'Instance (URL)', '50%'),
                                        secretField('mastodonAccessToken', "Token d'accès", '50%'),
                                    ],
                                },
                            ],
                        },
                        {
                            type: 'collapsible',
                            label: 'Payload CMS',
                            admin: { initCollapsed: true },
                            fields: [
                                { name: 'payloadPublishMode', type: 'select', defaultValue: 'DIRECT', options: PUBLISH_MODES, label: 'Mode' },
                                {
                                    type: 'row',
                                    fields: [
                                        secretField('payloadServerUrl', 'URL serveur Payload', '33%'),
                                        secretField('payloadBotEmail', 'Email bot Payload', '33%'),
                                        secretField('payloadBotPassword', 'Mot de passe bot Payload', '33%'),
                                    ],
                                },
                            ],
                        },
                    ],
                },
                {
                    label: 'Planification',
                    fields: [
                        {
                            type: 'row',
                            fields: [
                                { name: 'schedulingMode', type: 'select', defaultValue: 'hybrid', options: SCHEDULING_MODES, admin: { width: '33%' } },
                                { name: 'scrapingInterval', type: 'number', defaultValue: 60, label: 'Intervalle (min)', admin: { width: '33%' } },
                                { name: 'minPublishDelay', type: 'number', defaultValue: 60, label: 'Délai min (s)', admin: { width: '33%' } },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                { name: 'maxPublishDelay', type: 'number', defaultValue: 120, label: 'Délai max (s)', admin: { width: '50%' } },
                                { name: 'daemonSchedule', type: 'textarea', defaultValue: '[]', label: 'Grille hebdo (JSON)', admin: { width: '50%' } },
                            ],
                        },
                    ],
                },
                {
                    label: 'IA & Concurrence',
                    fields: [
                        secretField('geminiApiKey', 'Clé API Gemini'),
                        {
                            type: 'row',
                            fields: [
                                { name: 'maxConcurrentTasks', type: 'number', defaultValue: 5, label: 'Tâches simultanées', admin: { width: '33%' } },
                                { name: 'similarityThreshold', type: 'number', defaultValue: 0.45, label: 'Seuil de similarité', admin: { width: '33%' } },
                                { name: 'dedupLookbackHours', type: 'number', defaultValue: 24, label: 'Fenêtre dedup (h)', admin: { width: '33%' } },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                { name: 'aiModelFlash', type: 'text', defaultValue: 'gemini-3.5-flash-lite', label: 'Modèle Flash (Analyse)', admin: { width: '50%' } },
                                { name: 'aiModelPro', type: 'text', defaultValue: 'gemini-3.5-flash-lite', label: 'Modèle Pro (Rédaction)', admin: { width: '50%' } },
                            ],
                        },
                        { name: 'customPromptModifier', type: 'textarea', label: 'Modificateur de prompt' },
                        { name: 'allowSourceImages', type: 'checkbox', defaultValue: true, label: 'Autoriser les images sources' },
                    ],
                },
                {
                    label: 'Prompts',
                    fields: [
                        { name: 'baseIdentityPrompt', type: 'textarea', label: 'Identité de base' },
                        { name: 'researchMissionPrompt', type: 'textarea', label: 'Mission de recherche' },
                        { name: 'vocabularyRulesPrompt', type: 'textarea', label: 'Règles de vocabulaire' },
                        { name: 'imageRulesPrompt', type: 'textarea', label: 'Règles d’images' },
                        { name: 'researcherSystemPrompt', type: 'textarea', label: 'Prompt système Researcher' },
                        { name: 'researcherRejectCriteria', type: 'textarea', label: 'Critères de rejet Researcher' },
                    ],
                },
                {
                    label: 'Journal',
                    fields: [
                        {
                            name: 'logLevel',
                            type: 'select',
                            defaultValue: 'INFO',
                            label: 'Niveau de journalisation',
                            options: [
                                { label: 'DEBUG — tout', value: 'DEBUG' },
                                { label: 'INFO — par défaut', value: 'INFO' },
                                { label: 'WARN — avertissements + erreurs', value: 'WARN' },
                                { label: 'ERROR — erreurs uniquement', value: 'ERROR' },
                            ],
                            admin: {
                                description: 'Seuil minimal des entrées écrites dans le fichier local et la collection Payload logs. La sortie terminal du daemon affiche toujours tout.',
                            },
                        },
                        {
                            type: 'row',
                            fields: [
                                {
                                    name: 'logRetentionDays',
                                    type: 'number',
                                    defaultValue: 14,
                                    label: 'Rétention (jours)',
                                    admin: {
                                        width: '50%',
                                        description: 'Âge maximal des entrées conservées dans la collection Payload logs (0 = conserver indéfiniment). Le daemon purge automatiquement au-delà.',
                                    },
                                },
                                {
                                    name: 'logMirrorPayload',
                                    type: 'checkbox',
                                    defaultValue: true,
                                    label: 'Miroir vers Payload',
                                    admin: {
                                        width: '50%',
                                        description: 'Envoie les entrées dans la collection Payload logs (nécessaire pour le heartbeat du cockpit et les filtres par nœud).',
                                    },
                                },
                            ],
                        },
                        {
                            name: 'logMirrorNodes',
                            type: 'text',
                            label: 'Nœuds suivis (JSON)',
                            defaultValue: '[]',
                            admin: {
                                description: 'Liste optionnelle de nœuds à mettre en avant dans le cockpit (ex. ["Node 1", "Daemon"]). Vide = tous.',
                            },
                        },
                    ],
                },
                {
                    label: 'Ingestion',
                    fields: [
                        { name: 'rss_feeds', type: 'textarea', defaultValue: '[]', label: 'Flux RSS (JSON)' },
                        { name: 'telegram_channels', type: 'textarea', defaultValue: '[]', label: 'Chaînes Telegram (JSON)' },
                        { name: 'google_news_queries', type: 'textarea', defaultValue: '[]', label: 'Requêtes Google News (JSON)' },
                        { name: 'keywords', type: 'textarea', defaultValue: '[]', label: 'Mots-clés (JSON)' },
                        { name: 'bannedKeywords', type: 'textarea', defaultValue: '[]', label: 'Mots-clés bannis (JSON)' },
                        {
                            name: 'pipelineGraphJson',
                            type: 'textarea',
                            label: 'Graphe du pipeline',
                            admin: {
                                description: 'Activez / désactivez les étapes du pipeline et réglez-les visuellement — le JSON est géré automatiquement.',
                                components: {
                                    beforeInput: ['/payload/components/PipelineGraphField'],
                                },
                            },
                        },
                    ],
                },
                {
                    label: 'Avancé',
                    fields: [
                        { name: 'social_targets_by_type_json', type: 'textarea', defaultValue: '{}', label: 'Cibles sociales par type (JSON)' },
                        {
                            name: 'availableModelsJson',
                            type: 'textarea',
                            defaultValue: DEFAULT_AVAILABLE_MODELS,
                            label: 'Modèles disponibles',
                            admin: {
                                description: 'Liste des modèles proposés dans le cockpit. Ajoutez/supprimez des entrées ici, la valeur est sauvegardée automatiquement.',
                                components: {
                                    beforeInput: ['/payload/components/ModelListField'],
                                },
                            },
                        },
                    ],
                },
            ],
        },
    ],
};
