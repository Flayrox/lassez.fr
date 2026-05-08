import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const settings = await prisma.globalSettings.findFirst();
        if (!settings) return NextResponse.json({ success: true, settings: {} });
        
        // On renvoie l'objet brut de Prisma, c'est le plus cohérent
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
            'videoIngestEnabled'
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
            'discordPublishMode', 'xPublishMode', 'blueskyPublishMode',
            'aiModelFlash', 'aiModelPro', 'customPromptModifier', 
            'daemonSchedule', 'pipelineGraphJson', 'keywords', 'bannedKeywords'
        ];
        stringFields.forEach(f => {
            if (body[f] !== undefined) {
                updateData[f] = typeof body[f] === 'string' ? body[f] : JSON.stringify(body[f]);
            }
        });

        // Utilisation de upsert pour garantir l'existence de l'ID 1
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
