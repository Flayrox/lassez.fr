import { NextResponse } from 'next/server';

export function GET(request: Request) {
    return NextResponse.redirect(new URL('/android-chrome-512x512.png', request.url), 307);
}
