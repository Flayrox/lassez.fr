import fs from 'fs';
import path from 'path';

// Le daemon Go écrit désormais dans logs/daemon.log (racine du repo).
function getLogPath() {
    return path.join(process.cwd(), 'logs', 'daemon.log');
}

export function logToDaemon(message: string) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${message}\n`;
    
    try {
        fs.mkdirSync(path.dirname(getLogPath()), { recursive: true });
        fs.appendFileSync(getLogPath(), formatted);
    } catch (e) {
        console.error("Failed to write to daemon.log", e);
    }
    
    // Console standard Next.js
    console.log(`[DAEMON-PROXY] ${message}`);
}

export function errorToDaemon(message: string, err?: any) {
    const timestamp = new Date().toISOString();
    const errMsg = err ? (err.message || err.toString()) : '';
    const formatted = `[${timestamp}] ❌ ERR: ${message} ${errMsg}\n`;
    
    try {
        fs.mkdirSync(path.dirname(getLogPath()), { recursive: true });
        fs.appendFileSync(getLogPath(), formatted);
    } catch (e) {
        console.error("Failed to write to daemon.log", e);
    }
    
    // Console standard Next.js
    console.error(`[DAEMON-PROXY] ❌ ERR: ${message}`, err || '');
}
