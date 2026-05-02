import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const TRACKED_PROCESSES = ['radar-daemon-rss', 'radar-daemon', 'radar-admin'] as const;

export const dynamic = 'force-dynamic';

async function getPm2States() {
    const { stdout } = await execAsync('npx pm2 jlist');
    const list = JSON.parse(stdout || '[]');

    const states: Record<string, { online: boolean; status: string; pid: number | null }> = {};
    for (const name of TRACKED_PROCESSES) {
        states[name] = { online: false, status: 'not-found', pid: null };
    }

    for (const proc of list) {
        const name = String(proc?.name || '');
        if (!TRACKED_PROCESSES.includes(name as any)) continue;
        const status = String(proc?.pm2_env?.status || 'unknown');
        const pid = Number(proc?.pid || 0) || null;
        states[name] = {
            online: status === 'online',
            status,
            pid
        };
    }

    return states;
}

export async function GET() {
    try {
        const states = await getPm2States();
        return NextResponse.json({ success: true, states });
    } catch (e: any) {
        return NextResponse.json(
            {
                success: false,
                error: e.message,
                details: 'Unable to read PM2 process list.'
            },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const target = body.target || 'radar-daemon-rss';
        const action = body.action || 'restart';

        // Security check for allowed targets and actions
        const allowedTargets = ['radar-daemon-rss', 'radar-daemon', 'all'];
        const allowedActions = ['start', 'stop', 'restart', 'reload'];

        if (!allowedTargets.includes(target) || !allowedActions.includes(action)) {
            return NextResponse.json({ success: false, error: 'Target or action not allowed.' }, { status: 400 });
        }

        const command = `npx pm2 ${action} ${target}`;
        
        const { stdout, stderr } = await execAsync(command);
        
        const states = await getPm2States().catch(() => null);

        return NextResponse.json({ 
            success: true, 
            message: `Executed: ${command}`,
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            states
        });
    } catch (e: any) {
        return NextResponse.json({ 
            success: false, 
            error: e.message, 
            details: 'Make sure pm2 is installed globally or in node_modules.' 
        }, { status: 500 });
    }
}
