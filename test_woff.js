import TextToSVG from 'text-to-svg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const fontPath = path.join(__dirname, 'node_modules', '@fontsource', 'playfair-display', 'files', 'playfair-display-latin-700-normal.woff');
    const textToSVG = TextToSVG.loadSync(fontPath);
    console.log('Successfully loaded WOFF font via text-to-svg!');
} catch (e) {
    console.error('Failed to parse WOFF:', e.message);
}
