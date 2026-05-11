import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // On récupère les 50 derniers logs
        const logs = await prisma.log.findMany({
            take: 50,
            orderBy: { timestamp: 'desc' }
        });
        
        return NextResponse.json({ success: true, logs: logs.reverse() });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
