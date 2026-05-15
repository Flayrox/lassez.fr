import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // On récupère les 50 derniers logs BDD (les anciens logs du daemon interne)
        const logsDb = await prisma.log.findMany({
            take: 30,
            orderBy: { timestamp: 'desc' }
        });
        
        let allLogs = [...logsDb];

        // On va chercher les logs de sortie PM2 pour radar-daemon directement dans les fichiers (plus rapide et fiable)
        try {
            const pm2LogsDir = path.join(os.homedir(), '.pm2', 'logs');
            let pm2Lines: string[] = [];

            if (fs.existsSync(pm2LogsDir)) {
                // Trouver le fichier radar-daemon-out*.log le plus récent
                const files = fs.readdirSync(pm2LogsDir);
                const daemonLogFiles = files.filter(f => f.startsWith('radar-daemon-out') && f.endsWith('.log'));
                
                // Trier par date de modif
                daemonLogFiles.sort((a, b) => {
                    return fs.statSync(path.join(pm2LogsDir, b)).mtimeMs - fs.statSync(path.join(pm2LogsDir, a)).mtimeMs;
                });

                if (daemonLogFiles.length > 0) {
                    const latestLogPath = path.join(pm2LogsDir, daemonLogFiles[0]);
                    const content = fs.readFileSync(latestLogPath, 'utf8');
                    pm2Lines = content.split('\n').filter(l => l.trim().length > 0).slice(-40);
                }
            }

            // Formater les lignes brutes lues du fichier
            const formattedPm2Logs = pm2Lines.map((line, idx) => {
                // pm2 out raw ressemble souvent juste à la chaîne brute
                let cleanMsg = line.replace(/\x1B\[\d+m/g, '').trim();
                
                // Si la ligne commence par un pattern PM2 (ex: "3|radar-da | ")
                if (cleanMsg.includes('|radar-da')) {
                    cleanMsg = cleanMsg.split('|').slice(2).join('|').trim();
                }
                
                // On essaie de deviner le niveau de log grossièrement
                let level = 'INFO';
                if (cleanMsg.includes('❌') || cleanMsg.includes('Erreur')) level = 'ERROR';
                else if (cleanMsg.includes('✅') || cleanMsg.includes('SUCCESS') || cleanMsg.includes('terminé')) level = 'SUCCESS';
                else if (cleanMsg.includes('⚠️') || cleanMsg.includes('Impossible')) level = 'WARN';
                
                let nodeId = 'PM2';
                if (cleanMsg.includes('[Daemon]')) nodeId = 'Daemon';
                else if (cleanMsg.includes('[Node 1')) nodeId = 'Node 1';
                else if (cleanMsg.includes('[Node 2')) nodeId = 'Node 2';
                else if (cleanMsg.includes('[Node 3')) nodeId = 'Node 3';
                else if (cleanMsg.includes('[Node 4')) nodeId = 'Node 4';
                else if (cleanMsg.includes('[Node 5')) nodeId = 'Node 5';
                else if (cleanMsg.includes('[Node 6')) nodeId = 'Node 6';

                return {
                    id: `pm2-file-${Date.now()}-${idx}`,
                    timestamp: new Date().toISOString(), // Approximation car le .log raw n'a pas toujours le TS
                    level,
                    nodeId: nodeId,
                    message: cleanMsg
                };
            });
            
            allLogs = [...formattedPm2Logs.reverse(), ...allLogs];
            allLogs = allLogs.slice(0, 50);
        } catch (pm2Err) {
            console.error("Impossible de récupérer les logs PM2 via fs:", pm2Err);
        }

        return NextResponse.json({ success: true, logs: allLogs.reverse() });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

