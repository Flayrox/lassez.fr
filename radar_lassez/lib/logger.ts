import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';

const LOG_FILE = path.join(process.cwd(), 'daemon.log');

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

class Logger {
    private async writeToDB(level: LogLevel, nodeId: string, message: string) {
        try {
            // Utilisation de executeRaw pour éviter les blocages de types Prisma Client stale
            await prisma.$executeRawUnsafe(
                `INSERT INTO Log (id, level, message, nodeId, timestamp) VALUES (?, ?, ?, ?, ?)`,
                crypto.randomUUID(),
                level,
                message,
                nodeId,
                new Date().toISOString()
            );
        } catch (e) {
            // On ne bloque pas si la DB est occupée, on écrit au moins dans le fichier
        }
    }

    private writeToFile(level: LogLevel, nodeId: string, message: string) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] [${nodeId}] ${message}\n`;
        fs.appendFileSync(LOG_FILE, logLine);
    }

    private log(level: LogLevel, nodeId: string, message: string) {
        const colors = {
            INFO: '\x1b[34m',    // Bleu
            WARN: '\x1b[33m',    // Jaune
            ERROR: '\x1b[31m',   // Rouge
            SUCCESS: '\x1b[32m', // Vert
            RESET: '\x1b[0m'
        };

        console.log(`${colors[level]}[${nodeId}] ${message}${colors.RESET}`);
        
        this.writeToFile(level, nodeId, message);
        this.writeToDB(level, nodeId, message);
    }

    info(nodeId: string, message: string) { this.log('INFO', nodeId, message); }
    warn(nodeId: string, message: string) { this.log('WARN', nodeId, message); }
    error(nodeId: string, message: string) { this.log('ERROR', nodeId, message); }
    success(nodeId: string, message: string) { this.log('SUCCESS', nodeId, message); }
}

export const logger = new Logger();
