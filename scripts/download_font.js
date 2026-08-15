import fs from 'fs';
import https from 'https';
import path from 'path';

const fontUrl = 'https://raw.githubusercontent.com/googlefonts/PlayfairDisplay/main/fonts/ttf/PlayfairDisplay-Bold.ttf';
const destPath = path.join(process.cwd(), 'public', 'fonts', 'PlayfairDisplay-Bold.ttf');

// Ensure directory exists
fs.mkdirSync(path.dirname(destPath), { recursive: true });

https.get(fontUrl, (res) => {
    if (res.statusCode !== 200) {
        console.error(`Failed to download: ${res.statusCode}`);
        return;
    }
    const fileStream = fs.createWriteStream(destPath);
    res.pipe(fileStream);
    fileStream.on('finish', () => {
        fileStream.close();
        console.log('Font downloaded successfully!', destPath);
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
