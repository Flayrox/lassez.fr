import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const settings = await prisma.globalSettings.findFirst();
        
        // Convert Prisma model to the key-value format expected by the frontend
        const mappedSettings: Record<string, any> = {
            daemon_rss_enabled: settings?.enableAutoPublish,
            enableAutoPublish: settings?.enableAutoPublish,
            enableX: settings?.enableX,
            enableMastodon: settings?.enableMastodon,
            enableBluesky: settings?.enableBluesky,
            enableDiscord: settings?.enableDiscord,
            enablePayloadCMS: settings?.enablePayloadCMS,
            discordPublishMode: settings?.discordPublishMode,
            xPublishMode: settings?.xPublishMode,
            blueskyPublishMode: settings?.blueskyPublishMode,
            scrapingInterval: settings?.scrapingInterval,
            scan_interval_hours: settings?.scrapingInterval ? settings.scrapingInterval / 60 : 1,
            minPublishDelay: settings?.minPublishDelay,
            maxPublishDelay: settings?.maxPublishDelay,
            maxConcurrentTasks: settings?.maxConcurrentTasks,
            similarityThreshold: settings?.similarityThreshold,
            aiModelFlash: settings?.aiModelFlash,
            aiModelPro: settings?.aiModelPro,
            customPromptModifier: settings?.customPromptModifier,
            keywords: settings?.keywords,
            bannedKeywords: settings?.bannedKeywords,
            pipeline_graph_json: settings?.pipelineGraphJson,
        };

        return NextResponse.json({ success: true, settings: mappedSettings });
    } catch (error: any) {
        console.error("Erreur API Radar Settings (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        
        const updateData: any = {};
        
        // Map frontend fields to Prisma fields
        if (body.enableAutoPublish !== undefined) updateData.enableAutoPublish = !!body.enableAutoPublish;
        if (body.auto_pilot_enabled !== undefined) updateData.enableAutoPublish = !!body.auto_pilot_enabled;
        if (body.daemon_rss_enabled !== undefined) updateData.enableAutoPublish = !!body.daemon_rss_enabled;
        
        if (body.enableX !== undefined) updateData.enableX = !!body.enableX;
        if (body.enableMastodon !== undefined) updateData.enableMastodon = !!body.enableMastodon;
        if (body.enableBluesky !== undefined) updateData.enableBluesky = !!body.enableBluesky;
        if (body.enableDiscord !== undefined) updateData.enableDiscord = !!body.enableDiscord;
        if (body.enablePayloadCMS !== undefined) updateData.enablePayloadCMS = !!body.enablePayloadCMS;
        
        if (body.scrapingInterval !== undefined) updateData.scrapingInterval = parseInt(body.scrapingInterval);
        if (body.scan_interval_hours !== undefined) updateData.scrapingInterval = Math.round(parseFloat(body.scan_interval_hours) * 60);
        
        if (body.minPublishDelay !== undefined) updateData.minPublishDelay = parseInt(body.minPublishDelay);
        if (body.maxPublishDelay !== undefined) updateData.maxPublishDelay = parseInt(body.maxPublishDelay);
        
        if (body.maxConcurrentTasks !== undefined) updateData.maxConcurrentTasks = parseInt(body.maxConcurrentTasks);
        if (body.similarityThreshold !== undefined) updateData.similarityThreshold = parseFloat(body.similarityThreshold);
        
        if (body.aiModelFlash !== undefined) updateData.aiModelFlash = body.aiModelFlash;
        if (body.aiModelPro !== undefined) updateData.aiModelPro = body.aiModelPro;
        if (body.customPromptModifier !== undefined) updateData.customPromptModifier = body.customPromptModifier;
        
        if (body.pipeline_graph_json !== undefined) {
            // @ts-ignore
            updateData.pipelineGraphJson = body.pipeline_graph_json;
        }

        
        if (body.keywords !== undefined) updateData.keywords = typeof body.keywords === 'string' ? body.keywords : JSON.stringify(body.keywords);
        if (body.bannedKeywords !== undefined) updateData.bannedKeywords = typeof body.bannedKeywords === 'string' ? body.bannedKeywords : JSON.stringify(body.bannedKeywords);

        await prisma.globalSettings.upsert({
            where: { id: 1 },
            update: updateData,
            create: { id: 1, ...updateData }
        });

        return NextResponse.json({ success: true, message: 'Paramètres mis à jour' });
    } catch (error: any) {
        console.error("Erreur API Radar Settings (PATCH):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
