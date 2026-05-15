import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // On récupère les 50 derniers logs BDD (les anciens logs du daemon interne)
        const logsDb = await prisma.log.findMany({
            take: 30,
            orderBy: { timestamp: 'desc' }
        });
        
        let allLogs = [...logsDb];

        // On essaie aussi d'aller chercher les 50 dernières lignes de la sortie PM2 pour radar-daemon
        try {
            const pm2Command = process.env.PM2_PATH || 'pm2';
            
            // On utilise ssh si le PM2 est sur le VPS distant
            let stdout = '';
            if (process.env.NODE_ENV === 'production' && process.env.VPS_HOST) {
                 const { stdout: remoteStdout } = await execAsync(`ssh root@${process.env.VPS_HOST} "pm2 logs radar-daemon --raw --lines 25 --nostream"`);
                 stdout = remoteStdout;
            } else {
                 const { stdout: localStdout } = await execAsync(`${pm2Command} logs radar-daemon --raw --lines 25 --nostream`);
                 stdout = localStdout;
            }

            
            // Format PM2 log brut (grâce à --raw) : "[Daemon] 🚀 Démarrage..." ou "[34m[Daemon] GlobalSettings chargées.[0m"
            const pm2Lines = stdout.split('\n')
                .filter(l => l.trim().length > 0 && !l.includes('Tailing last'))
                .map((line, idx) => {
                    // Supprimer les codes ANSI de couleurs (ex: [34m)
                    let cleanMsg = line.replace(/\x1B\[\d+m/g, '').trim();
                    
                    // Si on n'a pas mis --raw ou si PM2 rajoute encore "3|radar-da |", on l'enlève en fallback
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
                        id: `pm2-${Date.now()}-${idx}`,
                        timestamp: new Date().toISOString(),
                        level,
                        nodeId: nodeId,
                        message: cleanMsg
                    };
                });
                
            allLogs = [...pm2Lines.reverse(), ...allLogs];
            // On garde les 50 plus récents au total (sachant que pm2Lines sont pseudo "maintenant")
            allLogs = allLogs.slice(0, 50);
        } catch (pm2Err) {
            console.error("Impossible de récupérer les logs PM2:", pm2Err);
        }

        return NextResponse.json({ success: true, logs: allLogs.reverse() });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

