import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const logPath = path.join(process.cwd(), 'logs', 'daemon.log');
        let lines: string[] = [];

        try {
            await fs.promises.access(logPath);
            const content = await fs.promises.readFile(logPath, 'utf8');
            // Split by newline and take the last 100 non-empty lines
            lines = content.split('\n').filter(l => l.trim().length > 0).slice(-100);
        } catch (err) {
            // File doesn't exist yet, we just return empty array
        }

        const formattedLogs = lines.map((line, idx) => {
            // Typical line: [2026-05-15T21:30:00.000Z] [INFO] [Node 1] Message
            const match = line.match(/^\[(.*?)\]\s+\[(.*?)\]\s+\[(.*?)\]\s+(.*)$/);
            
            if (match) {
                return {
                    id: `log-${Date.now()}-${idx}`,
                    timestamp: match[1],
                    level: match[2],
                    nodeId: match[3],
                    message: match[4]
                };
            } else {
                // Fallback for badly formatted lines
                let level = 'INFO';
                if (line.includes('ERROR') || line.includes('❌')) level = 'ERROR';
                
                return {
                    id: `log-${Date.now()}-${idx}`,
                    timestamp: new Date().toISOString(), // Fallback
                    level,
                    nodeId: 'SYSTEM',
                    message: line
                };
            }
        });

        // Reverse to get newest first
        return NextResponse.json({ success: true, logs: formattedLogs.reverse().slice(0, 50) });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

