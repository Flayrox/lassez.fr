import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function sneakyDownload() {
    console.log('Fetching CSS to steal TTF URL...');
    // Requesting weight 900 (Black)
    const cssUrl = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,900&display=swap';

    // User Agent from an ancient browser to force TTF instead of WOFF2
    const res = await axios.get(cssUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:33.0) Gecko/20120101 Firefox/33.0' // Firefox 33 -> WOFF/TTF
        }
    });

    const css = res.data;
    console.log("CSS Response:", css);

    // Extract url
    const urlMatch = css.match(/url\((https:\/\/[^)]+)\)/);
    if (!urlMatch) {
        console.log('No URL found!');
        return;
    }

    const fontUrl = urlMatch[1];
    console.log('Found Font URL:', fontUrl);

    const fontRes = await axios.get(fontUrl, { responseType: 'arraybuffer' });
    const outputDir = path.join(__dirname, 'public', 'fonts');
    fs.mkdirSync(outputDir, { recursive: true });

    const dest = path.join(outputDir, 'PlayfairDisplay-Black.ttf');
    fs.writeFileSync(dest, Buffer.from(fontRes.data));
    console.log('Saved PlayfairDisplay-Black.ttf successfully! Size:', fontRes.data.byteLength);
}

sneakyDownload().catch(console.error);
