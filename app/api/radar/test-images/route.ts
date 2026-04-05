import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

const runScript = (cmd: string, cwd: string) => new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
    });
});

export async function POST() {
    try {
        const scriptDir = path.join(process.cwd(), 'radar_lassez');
        await runScript('node test_discord.js', scriptDir);
        await runScript('node test_discord_horizontal.js', scriptDir);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Erreur de test images:", error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
