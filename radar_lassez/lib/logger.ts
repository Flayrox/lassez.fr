import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');
const LOG_FILE = path.join(LOG_DIR, 'daemon.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

class Logger {
    private originalConsoleLog = console.log;
    private originalConsoleError = console.error;

    constructor() {
        if (!fs.existsSync(LOG_DIR)) {
            fs.mkdirSync(LOG_DIR, { recursive: true });
        }
    }

    public overrideConsole() {
        console.log = (...args) => {
            const msg = args.join(' ');
            this.logRaw('INFO', msg);
        };
        console.error = (...args) => {
            const msg = args.join(' ');
            this.logRaw('ERROR', msg);
        };
    }

    private logRaw(level: LogLevel, message: string) {
        // Try to extract node ID if it's in the message like "[Node 6: Phase A]"
        let nodeId = 'SYSTEM';
        const match = message.match(/\[Node (\d+)[:\]]/i);
        if (match) {
            nodeId = `Node ${match[1]}`;
        } else if (message.includes('[Daemon]')) {
            nodeId = 'Daemon';
        }
        
        // Remove ANSI codes for the file log
        const cleanMsg = message.replace(/\x1B\[\d+m/g, '').trim();
        this.writeToFile(level, nodeId, cleanMsg);

        // Still output to terminal
        const timestamp = new Date().toISOString();
        const colors = { INFO: '\x1b[34m', WARN: '\x1b[33m', ERROR: '\x1b[31m', SUCCESS: '\x1b[32m', RESET: '\x1b[0m' };
        
        // Only use originalConsoleLog so we don't infinitely loop
        if (level === 'ERROR') {
            this.originalConsoleError(`${colors[level]}[${timestamp}] [${nodeId}] ${message}${colors.RESET}`);
        } else {
            this.originalConsoleLog(`${colors[level]}[${timestamp}] [${nodeId}] ${message}${colors.RESET}`);
        }
    }

    private writeToFile(level: LogLevel, nodeId: string, message: string) {
        const timestamp = new Date().toISOString();
        const logLine = `[${timestamp}] [${level}] [${nodeId}] ${message}\n`;
        
        try {
            if (fs.existsSync(LOG_FILE)) {
                const stats = fs.statSync(LOG_FILE);
                if (stats.size >= MAX_LOG_SIZE) {
                    fs.renameSync(LOG_FILE, path.join(LOG_DIR, 'daemon.old.log'));
                }
            }
            fs.appendFileSync(LOG_FILE, logLine);
        } catch (e) {
            console.error(`[Logger] Failed to write log:`, e);
        }
    }

    private log(level: LogLevel, nodeId: string, message: string) {
        const colors = {
            INFO: '\x1b[34m',    // Bleu
            WARN: '\x1b[33m',    // Jaune
            ERROR: '\x1b[31m',   // Rouge
            SUCCESS: '\x1b[32m', // Vert
            RESET: '\x1b[0m'
        };

        const timestamp = new Date().toISOString();
        this.originalConsoleLog(`${colors[level]}[${timestamp}] [${nodeId}] ${message}${colors.RESET}`);
        
        this.writeToFile(level, nodeId, message);
    }

    info(nodeId: string, message: string) { this.log('INFO', nodeId, message); }
    warn(nodeId: string, message: string) { this.log('WARN', nodeId, message); }
    error(nodeId: string, message: string) { this.log('ERROR', nodeId, message); }
    success(nodeId: string, message: string) { this.log('SUCCESS', nodeId, message); }
}

export const logger = new Logger();
