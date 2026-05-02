import { NextResponse } from 'next/server';

export function GET(request: Request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'lassez.fr';
    const proto = request.headers.get('x-forwarded-proto') || 'https';
    
    // Si Nginx ne passe pas x-forwarded-host, et que host = localhost:3001, on force
    const finalHost = host.includes('localhost') ? 'lassez.fr' : host;
    
    return NextResponse.redirect(`${proto}://${finalHost}/android-chrome-512x512.png`, 307);
}
