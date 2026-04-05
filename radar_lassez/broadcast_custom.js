import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { broadcastToSocials } from './socials.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const text = process.argv[2];
    const imageUrl = process.argv[3];

    if (!text) {
        console.error("Usage: node broadcast_custom.js <text> [image_url]");
        process.exit(1);
    }

    let localPath = null;
    let tempFile = null;

    if (imageUrl && imageUrl.startsWith('http')) {
        try {
            console.log(`[CUSTOM-BROADCAST] Downloading image: ${imageUrl}`);
            const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
            const buffer = Buffer.from(response.data);
            const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
            tempFile = path.join(__dirname, `temp_custom_${Date.now()}${ext}`);
            fs.writeFileSync(tempFile, buffer);
            localPath = tempFile;
        } catch (err) {
            console.error(`[CUSTOM-BROADCAST] Failed to download image: ${err.message}`);
        }
    } else if (imageUrl && fs.existsSync(imageUrl)) {
        localPath = imageUrl;
    }

    try {
        console.log(`[CUSTOM-BROADCAST] Broadcasting to socials...`);
        // skipLink is true by default for custom posts
        await broadcastToSocials(text, localPath, '', true);
        console.log(`[CUSTOM-BROADCAST] Success!`);
    } catch (err) {
        console.error(`[CUSTOM-BROADCAST] Error: ${err.message}`);
    } finally {
        if (tempFile && fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile);
        }
    }
}

run();
