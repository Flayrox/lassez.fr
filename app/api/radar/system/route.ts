import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import http from 'http';
import { logger } from '@/radar_lassez/lib/logger';

const execAsync = promisify(exec);
const TRACKED_PROCESSES = ['radar-daemon', 'radar-api', 'radar-front', 'radar-studio'] as const;

export const dynamic = 'force-dynamic';

function queryDockerSocket(path: string, method = 'GET', postData?: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const options = {
            socketPath: '/var/run/docker.sock',
            path,
            method,
            headers: postData ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            } : {}
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`Docker API returned status code ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', (err) => {
            reject(err);
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

async function getPm2StatesFallback() {
    try {
        const { stdout } = await execAsync('pm2 jlist');
        let jsonStr = stdout || '[]';
        const firstBracket = jsonStr.indexOf('[');
        if (firstBracket !== -1) {
            jsonStr = jsonStr.substring(firstBracket);
        }
        const list = JSON.parse(jsonStr);
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
    } catch {
        const states: Record<string, { online: boolean; status: string; pid: number | null }> = {};
        for (const name of TRACKED_PROCESSES) {
            states[name] = { online: false, status: 'offline', pid: null };
        }
        return states;
    }
}

async function getDockerOrPm2States() {
    try {
        const jsonStr = await queryDockerSocket('/containers/json?all=1');
        const containers = JSON.parse(jsonStr);
        
        const states: Record<string, { online: boolean; status: string; pid: number | null }> = {};
        for (const name of TRACKED_PROCESSES) {
            states[name] = { online: false, status: 'offline', pid: null };
        }

        for (const container of containers) {
            const names = (container.Names || []).map((n: string) => n.replace(/^\//, ''));
            for (const name of names) {
                if (TRACKED_PROCESSES.includes(name as any)) {
                    const status = container.State || 'unknown';
                    states[name] = {
                        online: status === 'running',
                        status: status === 'running' ? 'online' : status,
                        pid: null
                    };
                }
            }
        }
        return states;
    } catch (err) {
        // Fallback to PM2 if Docker socket is not available
        return getPm2StatesFallback();
    }
}

export async function GET() {
    try {
        const states = await getDockerOrPm2States();
        return NextResponse.json({ success: true, states });
    } catch (e: any) {
        return NextResponse.json(
            {
                success: false,
                error: e.message,
                details: 'Unable to read process list.'
            },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}));
        const target = body.target || 'radar-daemon';
        const action = body.action || 'restart';

        const allowedTargets = [...TRACKED_PROCESSES, 'all'];
        const allowedActions = ['start', 'stop', 'restart'];

        if (!allowedTargets.includes(target) || !allowedActions.includes(action)) {
            return NextResponse.json({ success: false, error: 'Target or action not allowed.' }, { status: 400 });
        }

        let dockerSuccess = false;
        try {
            const dockerAction = action === 'restart' ? 'restart' : action === 'stop' ? 'stop' : 'start';
            
            if (target === 'all') {
                for (const name of TRACKED_PROCESSES) {
                    await queryDockerSocket(`/containers/${name}/${dockerAction}`, 'POST');
                }
            } else {
                await queryDockerSocket(`/containers/${target}/${dockerAction}`, 'POST');
            }
            dockerSuccess = true;
            logger.info('System', `Executed Docker Action: ${action} on ${target}`);
        } catch (dockerErr) {
            // Docker failed or socket not available, fall back to PM2 exec
            const pm2Command = process.env.PM2_PATH || 'pm2';
            const command = `${pm2Command} ${action} ${target}`;
            await execAsync(command);
            logger.info('System', `Executed PM2 Action: ${action} on ${target}`);
        }

        const states = await getDockerOrPm2States().catch(() => null);

        return NextResponse.json({ 
            success: true, 
            message: `Executed: ${action} on ${target}`,
            states
        });
    } catch (e: any) {
        return NextResponse.json({ 
            success: false, 
            error: e.message, 
            details: 'Action execution failed.' 
        }, { status: 500 });
    }
}

