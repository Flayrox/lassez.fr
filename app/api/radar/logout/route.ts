import { NextResponse } from 'next/server';

export async function POST() {
    const response = NextResponse.json({ success: true });

    // On efface le cookie en le mettant expiré
    response.cookies.set('radar_session', '', {
        httpOnly: true,
        expires: new Date(0),
        path: '/'
    });

    return response;
}
