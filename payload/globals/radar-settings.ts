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
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { value: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash-Lite' },
    { value: 'gemini-2.0-pro-exp', label: 'Gemini 2.0 Pro Exp' },
]);

/**
 * Radar Settings — configuration globale du daemon (ex table Prisma GlobalSettings).
 * Singleton Payload : une seule instance, éditée depuis l'interface admin unifiée.
 */
export const radarSettings: GlobalConfig = {
    slug: 'radar-settings',
    label: 'Radar Settings',
    access: {
        read: isAdmin,
        update: isAdmin,
    },
    admin: {
        description: 'Configuration globale du pipeline Radar (sources, IA, diffusion, planification).',
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
                            type: 'row',
                            fields: [
                                { name: 'enableDiscord', type: 'checkbox', defaultValue: true, label: 'Discord', admin: { width: '25%' } },
                                { name: 'enableX', type: 'checkbox', defaultValue: false, label: 'X / Twitter', admin: { width: '25%' } },
                                { name: 'enableBluesky', type: 'checkbox', defaultValue: false, label: 'Bluesky', admin: { width: '25%' } },
                                { name: 'enableMastodon', type: 'checkbox', defaultValue: false, label: 'Mastodon', admin: { width: '25%' } },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                { name: 'discordPublishMode', type: 'select', defaultValue: 'DIRECT', options: PUBLISH_MODES, label: 'Mode Discord', admin: { width: '25%' } },
                                { name: 'xPublishMode', type: 'select', defaultValue: 'SCHEDULED', options: PUBLISH_MODES, label: 'Mode X', admin: { width: '25%' } },
                                { name: 'blueskyPublishMode', type: 'select', defaultValue: 'SCHEDULED', options: PUBLISH_MODES, label: 'Mode Bluesky', admin: { width: '25%' } },
                                { name: 'mastodonPublishMode', type: 'select', defaultValue: 'SCHEDULED', options: PUBLISH_MODES, label: 'Mode Mastodon', admin: { width: '25%' } },
                            ],
                        },
                        { name: 'payloadPublishMode', type: 'select', defaultValue: 'DIRECT', options: PUBLISH_MODES, label: 'Mode Payload CMS' },
                        {
                            type: 'row',
                            fields: [
                                { name: 'discordEmbedColor', type: 'text', defaultValue: '#DC2626', label: 'Couleur embed Discord (hex)', admin: { width: '50%' } },
                                { name: 'discordFooterText', type: 'text', defaultValue: 'Radar L\'Assez • Investigation', label: 'Footer embed Discord', admin: { width: '50%' } },
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
                                { name: 'aiModelFlash', type: 'text', defaultValue: 'gemini-3.1-flash-lite-preview', label: 'Modèle Flash (Analyse)', admin: { width: '50%' } },
                                { name: 'aiModelPro', type: 'text', defaultValue: 'gemini-3-flash-preview', label: 'Modèle Pro (Rédaction)', admin: { width: '50%' } },
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
                    label: 'Ingestion',
                    fields: [
                        { name: 'rss_feeds', type: 'textarea', defaultValue: '[]', label: 'Flux RSS (JSON)' },
                        { name: 'telegram_channels', type: 'textarea', defaultValue: '[]', label: 'Chaînes Telegram (JSON)' },
                        { name: 'google_news_queries', type: 'textarea', defaultValue: '[]', label: 'Requêtes Google News (JSON)' },
                        { name: 'keywords', type: 'textarea', defaultValue: '[]', label: 'Mots-clés (JSON)' },
                        { name: 'bannedKeywords', type: 'textarea', defaultValue: '[]', label: 'Mots-clés bannis (JSON)' },
                        { name: 'pipelineGraphJson', type: 'textarea', label: 'Graphe du pipeline (JSON)' },
                    ],
                },
                {
                    label: 'API & Webhooks',
                    fields: [
                        { name: 'discordWebhookUrl', type: 'text', label: 'Webhook Discord' },
                        {
                            type: 'row',
                            fields: [
                                { name: 'xApiKey', type: 'text', label: 'X API Key', admin: { width: '50%' } },
                                { name: 'xApiSecret', type: 'text', label: 'X API Secret', admin: { width: '50%' } },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                { name: 'xAccessToken', type: 'text', label: 'X Access Token', admin: { width: '50%' } },
                                { name: 'xAccessSecret', type: 'text', label: 'X Access Secret', admin: { width: '50%' } },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                { name: 'mastodonInstanceUrl', type: 'text', label: 'Instance Mastodon', admin: { width: '50%' } },
                                { name: 'mastodonAccessToken', type: 'text', label: 'Token Mastodon', admin: { width: '50%' } },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                { name: 'blueskyIdentifier', type: 'text', label: 'Identifiant Bluesky', admin: { width: '50%' } },
                                { name: 'blueskyAppPassword', type: 'text', label: 'Mot de passe app Bluesky', admin: { width: '50%' } },
                            ],
                        },
                        {
                            type: 'row',
                            fields: [
                                { name: 'payloadServerUrl', type: 'text', label: 'URL serveur Payload', admin: { width: '33%' } },
                                { name: 'payloadBotEmail', type: 'text', label: 'Email bot Payload', admin: { width: '33%' } },
                                { name: 'payloadBotPassword', type: 'text', label: 'Mot de passe bot Payload', admin: { width: '33%' } },
                            ],
                        },
                    ],
                },
                {
                    label: 'Avancé',
                    fields: [
                        { name: 'social_targets_by_type_json', type: 'textarea', defaultValue: '{}', label: 'Cibles sociales par type (JSON)' },
                        { name: 'availableModelsJson', type: 'textarea', defaultValue: DEFAULT_AVAILABLE_MODELS, label: 'Modèles disponibles (JSON)' },
                    ],
                },
            ],
        },
    ],
};
