import { NextRequest, NextResponse } from 'next/server';

// Proxy route to bypass CORS on external images (Unsplash, etc.)
// Usage: /api/proxy-image?url=https://images.unsplash.com/...
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    // Allow list for extra safety — only https external images
    const allowed = ['images.unsplash.com', 'unsplash.com', 'plus.unsplash.com', 'source.unsplash.com', 'picsum.photos', 'fastly.picsum.photos', 'lh3.googleusercontent.com'];
    let parsed: URL;
    try {
        parsed = new URL(url);
        // Must be https and either on the allowlist OR a generic image host
        const isAllowed = allowed.some(d => parsed.hostname.endsWith(d));
        const isHttps = parsed.protocol === 'https:';
        if (!isHttps || (!isAllowed && !parsed.hostname)) {
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
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
                'Cache-Control': 'public, max-age=86400',
            },
        });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
