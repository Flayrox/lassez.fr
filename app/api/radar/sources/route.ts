import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';
import { logger } from '@/radar_lassez/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const payload = await getPayloadClient();
        const result = await payload.find({
            collection: 'sources',
            limit: 500,
            depth: 0,
            sort: '-createdAt',
        });
        return NextResponse.json({ success: true, sources: result.docs });
    } catch (error: any) {
        console.error("Erreur API Radar Sources (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, type, source_name, source_bias, trust_score, allowSourceImages } = body;

        if (!url || !type || !source_name) {
            return NextResponse.json({ success: false, error: 'Champs requis manquants' }, { status: 400 });
        }

        const payload = await getPayloadClient();
        const source = await payload.create({
            collection: 'sources',
            data: {
                url,
                type,
                source_name,
                source_bias: source_bias || 'Centre',
                trust_score: parseInt(trust_score) || 5,
                allow_source_images: allowSourceImages !== undefined ? !!allowSourceImages : true,
                active: true,
            },
        });

        logger.success("Admin", `Nouvelle source ajoutée : ${source_name} (${type})`);
        return NextResponse.json({ success: true, source });
    } catch (error: any) {
        logger.error("Admin", `Échec de création de source : ${error.message}`);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) return NextResponse.json({ success: false, error: 'ID requis' }, { status: 400 });

        const dataToUpdate: any = {};
        // Mapping snake_case Payload
        for (const [k, v] of Object.entries(updates)) {
            if (k === 'trust_score') dataToUpdate.trust_score = parseInt(v as any);
            else if (k === 'allowSourceImages') dataToUpdate.allow_source_images = !!v;
            else if (k === 'active') dataToUpdate.active = !!v;
            else if (k === 'source_name') dataToUpdate.source_name = v;
            else if (k === 'source_bias') dataToUpdate.source_bias = v;
            else if (k === 'type') dataToUpdate.type = v;
            else dataToUpdate[k] = v;
        }

        const payload = await getPayloadClient();
        const source = await payload.update({ collection: 'sources', id, data: dataToUpdate });

        logger.success("Admin", `Source mise à jour (${source.source_name || id}).`);
        return NextResponse.json({ success: true, source });
    } catch (error: any) {
        logger.error("Admin", `Erreur mise à jour source : ${error.message}`);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, error: 'ID requis' }, { status: 400 });

        const payload = await getPayloadClient();
        await payload.delete({ collection: 'sources', id });

        return NextResponse.json({ success: true, message: 'Source supprimée' });
    } catch (error: any) {
        console.error("Erreur API Radar Sources (DELETE):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
