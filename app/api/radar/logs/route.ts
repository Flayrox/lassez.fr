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
            const { stdout } = await execAsync(`${pm2Command} logs radar-daemon --lines 25 --nostream`);
            
            // Format PM2 log: "3|radar-da | [Daemon] 🚀 Démarrage..." ou "3|radar-da | [34m[Daemon] GlobalSettings chargées.[0m"
            const pm2Lines = stdout.split('\n')
                .filter(l => l.includes('|radar-da'))
                .map((line, idx) => {
                    // Supprimer les codes ANSI de couleurs (ex: [34m)
                    const cleanAnsi = line.replace(/\x1B\[\d+m/g, '');
                    const cleanMsg = cleanAnsi.split('|').slice(2).join('|').trim();
                    
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

