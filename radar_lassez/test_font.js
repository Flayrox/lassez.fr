import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fontPath = path.join(__dirname, '..', 'node_modules', '@fontsource', 'playfair-display', 'files', 'playfair-display-latin-700-normal.woff');
const fontBuffer = fs.readFileSync(fontPath);
const base64Font = fontBuffer.toString('base64');

const svg = `
        <svg width="600" height="200" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <style>
                    @font-face {
                        font-family: 'PlayfairCustom';
                        src: url('data:font/woff;charset=utf-8;base64,${base64Font}') format('woff');
                        font-weight: 700;
                        font-style: normal;
                    }
                </style>
            </defs>
            <rect width="100%" height="100%" fill="white" />
            <text x="300" y="100" font-family="PlayfairCustom, serif" font-weight="700" font-size="40" fill="black" text-anchor="middle">L'ASSEZ TEST WOFF</text>
        </svg>
    `;

await sharp(Buffer.from(svg))
    .png()
    .toFile('font_test_woff.png');

console.log("Done. Check font_test_woff.png", fs.existsSync('font_test_woff.png'));
}

testFont().catch(console.error);
