import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptPath = path.join(__dirname, 'index.js');
const logPath = path.join(__dirname, 'trigger.log');

console.log(`📡 Simulating Next.js trigger...`);

const out = fs.openSync(logPath, 'a');
const err = fs.openSync(logPath, 'a');

const child = spawn('node', [scriptPath], {
    cwd: __dirname,
    detached: true,
    stdio: ['ignore', out, err]
    // Crucially not passing process.env to mimic Next.js isolation, or maybe Next.js does pass it?
    // Let's pass it to match default spawn behavior.
});

child.unref();
console.log("Started detached child.");
