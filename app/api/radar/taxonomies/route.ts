import { NextResponse } from 'next/server';
import { getPayloadClient } from '@/lib/payload';

// GET: List all taxonomy templates
export async function GET() {
    try {
        const payload = await getPayloadClient();
        const result = await payload.find({
            collection: 'taxonomy-templates',
            limit: 500,
            depth: 0,
            sort: 'sort_order',
        });
        return NextResponse.json({ success: true, taxonomies: result.docs });
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

        const payload = await getPayloadClient();
        const taxonomy = await payload.create({
            collection: 'taxonomy-templates',
            data: {
                name: name.toUpperCase(),
                display_name: displayName,
                description: description || '',
                format_instructions: formatInstructions || '',
                examples_json: typeof examplesJson === 'string' ? JSON.parse(examplesJson || '[]') : (examplesJson || []),
                output_schema_json: typeof outputSchemaJson === 'string' ? JSON.parse(outputSchemaJson || '{}') : (outputSchemaJson || {}),
                accent_color: accentColor || '#000000',
                is_factory: false,
                active: true,
                sort_order: 99,
            },
        });

        return NextResponse.json({ success: true, taxonomy });
    } catch (error: any) {
        if (String(error?.message || '').includes('unique') || String(error?.message || '').includes('duplicate')) {
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

        // Mapping snake_case Payload
        const data: any = {};
        const map: Record<string, string> = {
            displayName: 'display_name',
            description: 'description',
            formatInstructions: 'format_instructions',
            accentColor: 'accent_color',
            active: 'active',
            sortOrder: 'sort_order',
        };
        for (const [k, v] of Object.entries(updates)) {
            const target = map[k] || k;
            if (k === 'examplesJson' || k === 'outputSchemaJson') {
                data[target] = typeof v === 'string' ? JSON.parse(v) : v;
            } else {
                data[target] = v;
            }
        }

        const payload = await getPayloadClient();
        const taxonomy = await payload.update({ collection: 'taxonomy-templates', id, data });

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

        const payload = await getPayloadClient();
        const taxonomy = await payload.findByID({ collection: 'taxonomy-templates', id, depth: 0 }).catch(() => null);
        if (!taxonomy) {
            return NextResponse.json({ success: false, error: 'Taxonomy not found' }, { status: 404 });
        }
        if (taxonomy.is_factory) {
            return NextResponse.json({ success: false, error: 'Cannot delete factory taxonomies. Disable them instead.' }, { status: 403 });
        }

        await payload.delete({ collection: 'taxonomy-templates', id });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
