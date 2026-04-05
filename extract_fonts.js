import axios from 'axios';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function downloadAndExtract() {
    console.log('Downloading ZIP from Google Fonts...');
    const url = 'https://fonts.google.com/download?family=Playfair%20Display';
    const response = await axios.get(url, { responseType: 'arraybuffer' });

    console.log(`Downloaded ${response.data.byteLength} bytes. Extracting...`);
    const zip = new AdmZip(Buffer.from(response.data));

    const outputDir = path.join(__dirname, 'public', 'fonts', 'playfair');
    fs.mkdirSync(outputDir, { recursive: true });

    zip.extractAllTo(outputDir, true);
    console.log('Extracted to', outputDir);
}

downloadAndExtract().catch(console.error);
