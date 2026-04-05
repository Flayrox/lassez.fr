import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function download() {
    console.log('Fetching TTF...');
    // Direct link to the raw TTF on Google Fonts repo
    const res = await fetch('https://github.com/google/fonts/raw/main/ofl/playfairdisplay/static/PlayfairDisplay-Bold.ttf');

    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fontPath = path.join(__dirname, 'public', 'fonts', 'PlayfairDisplay-Bold.ttf');
    fs.mkdirSync(path.dirname(fontPath), { recursive: true });

    fs.writeFileSync(fontPath, buffer);
    console.log('Downloaded TTF size:', buffer.length, 'to', fontPath);
}

download().catch(console.error);
