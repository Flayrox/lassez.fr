import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: List all taxonomy templates
export async function GET() {
    try {
        const taxonomies = await prisma.taxonomyTemplate.findMany({
            orderBy: { sortOrder: 'asc' },
        });
        return NextResponse.json({ success: true, taxonomies });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// POST: Create a new taxonomy template
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { name, displayName, description, formatInstructions, examplesJson, outputSchemaJson, accentColor } = body;

        if (!name || !displayName) {
            return NextResponse.json({ success: false, error: 'name and displayName are required' }, { status: 400 });
        }

        const taxonomy = await prisma.taxonomyTemplate.create({
            data: {
                name: name.toUpperCase(),
                displayName,
                description: description || '',
                formatInstructions: formatInstructions || '',
                examplesJson: examplesJson || '[]',
                outputSchemaJson: outputSchemaJson || '{}',
                accentColor: accentColor || '#000000',
                isFactory: false,
                active: true,
                sortOrder: 99,
            },
        });

        return NextResponse.json({ success: true, taxonomy });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json({ success: false, error: `Taxonomy already exists.` }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// PATCH: Update an existing taxonomy template
export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        const { id, ...updates } = body;

        if (!id) {
            return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
        }

        const taxonomy = await prisma.taxonomyTemplate.update({
            where: { id },
            data: updates,
        });

        return NextResponse.json({ success: true, taxonomy });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

// DELETE: Remove a non-factory taxonomy
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'id query param is required' }, { status: 400 });
        }

        const taxonomy = await prisma.taxonomyTemplate.findUnique({ where: { id } });
        if (!taxonomy) {
            return NextResponse.json({ success: false, error: 'Taxonomy not found' }, { status: 404 });
        }
        if (taxonomy.isFactory) {
            return NextResponse.json({ success: false, error: 'Cannot delete factory taxonomies. Disable them instead.' }, { status: 403 });
        }

        await prisma.taxonomyTemplate.delete({ where: { id } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
