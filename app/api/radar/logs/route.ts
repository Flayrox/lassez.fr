import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        const logPath = path.join(process.cwd(), 'radar_lassez', 'daemon.log');

        if (!fs.existsSync(logPath)) {
            return NextResponse.json({ success: true, logs: ["Log file not found."] });
        }

        // Read the file and get the last 500 lines
        const content = fs.readFileSync(logPath, 'utf8');
        const lines = content.split('\n');
        const lastLines = lines.slice(-500);

        return NextResponse.json({ success: true, logs: lastLines });
    } catch (error: any) {
        console.error("Erreur API Radar Logs (GET):", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
