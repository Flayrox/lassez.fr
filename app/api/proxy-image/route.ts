import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'dns/promises';

// Proxy route to bypass CORS on external images (Unsplash, etc.)
// Usage: /api/proxy-image?url=https://images.unsplash.com/...

/** Bloque les IP privées / loopback / link-local (anti-SSRF). */
function isBlockedIp(ip: string): boolean {
    if (!ip) return true;

    // IPv6: loopback, link-local, ULA
    if (ip === '::1' || ip === '::' || ip.startsWith('fe80') || ip.startsWith('fc') || ip.startsWith('fd')) return true;

    const parts = ip.split('.');
    if (parts.length !== 4) return true;
    const [a, b] = parts.map(Number);

    // 10.0.0.0/8, 127.0.0.0/8, 169.254.0.0/16 (link-local), 0.0.0.0/8, 192.168.0.0/16
    if (a === 10 || a === 127 || a === 169 || a === 0 || a === 192) return true;
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true;
    // 100.64.0.0/10 (CGNAT) et 198.18.0.0/15 (benchmark)
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;

    return false;
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');
    if (!url) return NextResponse.json({ error: 'Missing url' }, { status: 400 });

    let parsed: URL;
    try {
        parsed = new URL(url);
        if (parsed.protocol !== 'https:') {
            return NextResponse.json({ error: 'HTTPS required' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Invalid url' }, { status: 400 });
    }

    // Anti-SSRF : résout le hostname et refuse les adresses internes.
    try {
        const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
        if (addresses.length === 0 || addresses.some(a => isBlockedIp(a.address))) {
            return NextResponse.json({ error: 'Forbidden host' }, { status: 403 });
        }
    } catch {
        return NextResponse.json({ error: 'Host resolution failed' }, { status: 400 });
    }

    try {
        const res = await fetch(url, {
            redirect: 'manual', // ne suit pas les redirections (protection SSRF)
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            }
        });

        // Les redirections sont refusées : on ne suit jamais un hostname non validé
        if (res.status >= 300 && res.status < 400) {
            return NextResponse.json({ error: 'Redirects are not allowed' }, { status: 502 });
        }
        
        
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
