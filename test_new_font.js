import TextToSVG from 'text-to-svg';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
    const fontPath = path.join(__dirname, 'public', 'fonts', 'PlayfairDisplay-Black.ttf');
    const textToSVG = TextToSVG.loadSync(fontPath);
    console.log('Successfully loaded new Google static font via text-to-svg!');
} catch (e) {
    console.error('Failed to parse:', e.message);
}
