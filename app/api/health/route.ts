import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Route GET /api/health
 * 
 * Endpoint léger de vérification de l'état de santé du serveur.
 * Utilisé par Coolify et le proxy Nginx pour vérifier que l'application Node/Next.js
 * réagit correctement sur les ports 3000, 3001 et 3002.
 */
export async function GET() {
    return NextResponse.json(
        {
            status: 'ok',
            service: 'lassez',
            timestamp: new Date().toISOString(),
        },
        { status: 200 }
    );
}
