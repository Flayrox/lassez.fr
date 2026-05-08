import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');
        const level = searchParams.get('level');
        const nodeId = searchParams.get('nodeId');

        const where: any = {};
        if (level) where.level = level;
        if (nodeId) where.nodeId = nodeId;

        const logs = await prisma.log.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit
        });

        return NextResponse.json({ success: true, logs });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        await prisma.log.deleteMany({});
        return NextResponse.json({ success: true, message: 'Logs nettoyés' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
