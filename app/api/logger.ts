import fs from 'fs';
import path from 'path';

export function logToDaemon(message: string) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${message}\n`;
    const logPath = path.join(process.cwd(), 'radar_lassez', 'daemon.log');
    
    try {
        fs.appendFileSync(logPath, formatted);
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
    const logPath = path.join(process.cwd(), 'radar_lassez', 'daemon.log');
    
    try {
        fs.appendFileSync(logPath, formatted);
    } catch (e) {
        console.error("Failed to write to daemon.log", e);
    }
    
    // Console standard Next.js
    console.error(`[DAEMON-PROXY] ❌ ERR: ${message}`, err || '');
}
