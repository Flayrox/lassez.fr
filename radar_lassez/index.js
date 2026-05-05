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
    console.log(`📍 DB_PATH: ${CONFIG.DB_PATH}`);
    console.log(`🔑 API_KEY: ${CONFIG.GEMINI_API_KEY ? 'Present (Ends with ' + CONFIG.GEMINI_API_KEY.slice(-4) + ')' : 'MISSING!'}`);
    
    const engine = new CoreEngine(CONFIG.DB_PATH, CONFIG.GEMINI_API_KEY);
    
    try {
        console.log('⚡ Starting runFullScan...');
        await engine.runFullScan();
        console.log('✅ runFullScan finished successfully.');
    } catch (error) {
        console.error('❌ [FATAL] Engine crash:', error.stack || error.message);
        process.exit(1);
    }
}

main();
