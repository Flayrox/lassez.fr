const fs = require('fs');

const path = 'app/(frontend)/radar-admin/daemon/page.tsx';
let c = fs.readFileSync(path, 'utf8');

const regex = /\{profilesOpen && \([\s\S]*?<\/div>\r?\n\s*\)\}/;

const modalOpenMatch = c.match(regex);
if (!modalOpenMatch) {
    console.error("Match not found!");
} else {
    console.log("Match found! length: " + modalOpenMatch[0].length);
}
