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
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });
        
        if (!res.ok) {
            console.error(`[Proxy Image] Fetch failed for ${url}: ${res.status} ${res.statusText}`);
            return NextResponse.json({ error: `Remote server responded with ${res.status} ${res.statusText}` }, { status: res.status === 404 ? 404 : 502 });
        }

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
