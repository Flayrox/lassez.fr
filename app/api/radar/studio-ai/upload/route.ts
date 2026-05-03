import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Ensure upload directory exists
        const uploadDir = join(process.cwd(), 'public', 'uploads');
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        // Clean filename, truncate if too long, and add timestamp
        const safeName = file.name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
        const truncatedName = safeName.length > 50 ? safeName.substring(safeName.lastIndexOf('.') - 50 || 0) : safeName;
        const filename = `${Date.now()}-${truncatedName}`;
        const path = join(uploadDir, filename);

        await writeFile(path, buffer);
        console.log(`[Studio AI] File uploaded: ${path}`);

        // Return the public URL
        return NextResponse.json({ 
            success: true, 
            url: `/uploads/${filename}` 
        });
    } catch (error: any) {
        console.error('[Studio AI] Upload error:', error);
        return NextResponse.json({ error: 'Erreur lors de l\'upload' }, { status: 500 });
    }
}
