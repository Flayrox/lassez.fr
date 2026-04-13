import { NextResponse } from 'next/server';
import { WP_API_URL } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const qs = searchParams.toString();
        const url = `${WP_API_URL}/categories${qs ? `?${qs}` : ''}`;

        const res = await fetch(url, { next: { revalidate: 300 } });
        const text = await res.text();

        return new NextResponse(text, {
            status: res.status,
            headers: {
                'Content-Type': res.headers.get('content-type') || 'application/json; charset=utf-8',
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            },
        });
    } catch {
        return NextResponse.json({ success: false, error: 'wp_categories_unavailable' }, { status: 502 });
    }
}
