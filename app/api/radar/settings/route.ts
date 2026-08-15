import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { logger } from '@/radar_lassez/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const payload = await getPayloadClient();
        const settings = await payload.findGlobal({ slug: 'radar-settings' }).catch(() => null);
        if (!settings) return NextResponse.json({ success: true, settings: {} });
        return NextResponse.json({ success: true, settings });
    } catch (error: any) {
        console.error("Erreur API Radar Settings (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const updateData: any = {};

        // 1. Toggles (Booleans)
        const boolFields = [
            'enableAutoPublish', 'enableX', 'enableMastodon',
            'enableBluesky', 'enableDiscord', 'enablePayloadCMS',
            'allowSourceImages'
        ];
        boolFields.forEach(f => {
            if (body[f] !== undefined) updateData[f] = !!body[f];
        });

        // 2. Numbers (Int/Float)
        if (body.scrapingInterval !== undefined) updateData.scrapingInterval = parseInt(body.scrapingInterval);
        if (body.minPublishDelay !== undefined) updateData.minPublishDelay = parseInt(body.minPublishDelay);
        if (body.maxPublishDelay !== undefined) updateData.maxPublishDelay = parseInt(body.maxPublishDelay);
        if (body.maxConcurrentTasks !== undefined) updateData.maxConcurrentTasks = parseInt(body.maxConcurrentTasks);
        if (body.dedupLookbackHours !== undefined) updateData.dedupLookbackHours = parseInt(body.dedupLookbackHours);
        if (body.similarityThreshold !== undefined) updateData.similarityThreshold = parseFloat(body.similarityThreshold);

        // 3. Strings
        const stringFields = [
            'discordPublishMode', 'xPublishMode', 'blueskyPublishMode', 'mastodonPublishMode', 'payloadPublishMode',
            'aiModelFlash', 'aiModelPro', 'customPromptModifier',
            'daemonSchedule', 'pipelineGraphJson', 'keywords', 'bannedKeywords',
            'rss_feeds', 'telegram_channels', 'google_news_queries', 'social_targets_by_type_json',
            'availableModelsJson',
            'discordWebhookUrl', 'xApiKey', 'xApiSecret', 'xAccessToken', 'xAccessSecret',
            'mastodonInstanceUrl', 'mastodonAccessToken', 'blueskyIdentifier', 'blueskyAppPassword',
            'payloadServerUrl', 'payloadBotEmail', 'payloadBotPassword',
            'baseIdentityPrompt', 'researchMissionPrompt', 'vocabularyRulesPrompt',
            'imageRulesPrompt', 'researcherSystemPrompt', 'researcherRejectCriteria',
            'schedulingMode'
        ];
        stringFields.forEach(f => {
            if (body[f] !== undefined) {
                updateData[f] = typeof body[f] === 'string' ? body[f] : JSON.stringify(body[f]);
            }
        });

        const payload = await getPayloadClient();
        await payload.updateGlobal({ slug: 'radar-settings', data: updateData });

        logger.info('System', 'Settings updated via UI (Payload)');
        return NextResponse.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (error: any) {
        console.error("Erreur API Radar Settings (PATCH):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
