import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { CoreEngine } from './lib/CoreEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const CONFIG = {
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    DB_PATH: path.join(__dirname, 'radar.db')
};

async function main() {
    console.log('--- RADAR CORTEX v3.0 ENGINE ---');
    const engine = new CoreEngine(CONFIG.DB_PATH, CONFIG.GEMINI_API_KEY);
    
    try {
        await engine.runFullScan();
    } catch (error) {
        console.error('❌ [FATAL] Engine crash:', error.message);
        process.exit(1);
    }
}

main();
