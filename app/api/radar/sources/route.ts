import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const sources = await prisma.source.findMany({
            orderBy: { createdAt: 'desc' }
        });
        return NextResponse.json({ success: true, sources });
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
            return NextResponse.json({ success: false, error: 'URL, Type et Nom de source requis' }, { status: 400 });
        }

        const source = await prisma.source.create({
            data: {
                url,
                type,
                source_name,
                source_bias: source_bias || 'Centre',
                trust_score: parseInt(trust_score) || 5,
                allowSourceImages: !!allowSourceImages
            }
        });

        return NextResponse.json({ success: true, source });
    } catch (error: any) {
        console.error("Erreur API Radar Sources (POST):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) return NextResponse.json({ success: false, error: 'ID requis' }, { status: 400 });

        const source = await prisma.source.update({
            where: { id },
            data: {
                ...updates,
                trust_score: updates.trust_score ? parseInt(updates.trust_score) : undefined,
                allowSourceImages: updates.allowSourceImages !== undefined ? !!updates.allowSourceImages : undefined
            }
        });

        return NextResponse.json({ success: true, source });
    } catch (error: any) {
        console.error("Erreur API Radar Sources (PATCH):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, error: 'ID requis' }, { status: 400 });

        await prisma.source.delete({ where: { id } });

        return NextResponse.json({ success: true, message: 'Source supprimée' });
    } catch (error: any) {
        console.error("Erreur API Radar Sources (DELETE):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
