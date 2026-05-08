import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const users = await prisma.adminUser.findMany({
            orderBy: { createdAt: 'desc' }
        });
        
        // Si aucun utilisateur n'existe (première installation), 
        // on pourrait en créer un par défaut ou renvoyer une liste vide.
        return NextResponse.json({ success: true, users });
    } catch (error: any) {
        console.error("Erreur API Users (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
