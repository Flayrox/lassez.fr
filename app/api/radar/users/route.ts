import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';

export const dynamic = 'force-dynamic';

/**
 * GET /api/radar/users
 *
 * Renvoie les utilisateurs admin/éditeurs du cockpit Radar. Depuis la
 * migration vers Payload, ils sont stockés dans la collection `authors`
 * (le single-login de l'admin Payload).
 */
export async function GET() {
    try {
        const payload = await getPayloadClient();
        const result = await payload.find({
            collection: 'authors',
            limit: 100,
            depth: 0,
            sort: '-createdAt',
        });

        const users = result.docs.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.roles?.[0] || 'VIEWER',
            lastLogin: u.loginAttempts ? null : null, // Payload ne stocke pas le lastLogin nativement
            createdAt: u.createdAt,
        }));

        return NextResponse.json({ success: true, users });
    } catch (error: any) {
        console.error("Erreur API Users (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
