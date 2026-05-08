import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/radar/sources
 * Récupère la liste de toutes les sources d'intelligence.
 */
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

/**
 * POST /api/radar/sources
 * Crée une nouvelle source d'acquisition.
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { url, type, source_name, source_bias, trust_score } = body;

        if (!url || !type || !source_name) {
            return NextResponse.json({ success: false, error: 'Champs requis manquants' }, { status: 400 });
        }

        const source = await prisma.source.create({
            data: {
                url,
                type,
                source_name,
                source_bias: source_bias || 'Centre',
                trust_score: parseInt(trust_score) || 5,
                allowSourceImages: true,
                active: true
            }
        });

        return NextResponse.json({ success: true, source });
    } catch (error: any) {
        console.error("Erreur API Radar Sources (POST):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/radar/sources
 * Met à jour une source existante (y compris le toggle active).
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, ...updates } = body;

        if (!id) return NextResponse.json({ success: false, error: 'ID requis' }, { status: 400 });

        // On prépare les données proprement
        const dataToUpdate: any = { ...updates };
        if (updates.trust_score !== undefined) dataToUpdate.trust_score = parseInt(updates.trust_score);
        
        // Note Senior : On utilise 'any' ici temporairement car le client Prisma est verrouillé par le serveur Next.js
        // ce qui empêche la régénération des types Typescript pour le champ 'active'.
        const source = await (prisma.source as any).update({
            where: { id },
            data: dataToUpdate
        });

        return NextResponse.json({ success: true, source });
    } catch (error: any) {
        console.error("Erreur API Radar Sources (PATCH):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/radar/sources
 */
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
