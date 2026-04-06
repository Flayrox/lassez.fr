import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const videoPath = searchParams.get('path');

        if (!videoPath) {
            return NextResponse.json({ error: 'Missing path' }, { status: 400 });
        }

        // Sécurité : Vérifier que le chemin est bien dans tmp-videos
        const absolutePath = path.resolve(videoPath);
        const allowedDir = path.resolve(process.cwd(), 'radar_lassez', 'tmp-videos');
        
        if (!absolutePath.startsWith(allowedDir)) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        if (!fs.existsSync(absolutePath)) {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        const fileBuffer = fs.readFileSync(absolutePath);
        const fileName = path.basename(absolutePath);

        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'video/mp4',
                'Content-Disposition': `inline; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
