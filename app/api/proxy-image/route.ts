import { NextRequest, NextResponse } from 'next/server';

// Proxy route to bypass CORS on external images (Unsplash, etc.)
// Usage: /api/proxy-image?url=https://images.unsplash.com/...
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            return NextResponse.json({ error: 'HTTPS required' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'lassez-proxy/1.0' }
        });
        if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 });

        const contentType = res.headers.get('content-type') || 'image/jpeg';
        const buffer = await res.arrayBuffer();

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*',
                'Cross-Origin-Resource-Policy': 'cross-origin', // Required for COEP
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
