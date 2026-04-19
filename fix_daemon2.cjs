const fs = require('fs');
const p = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt = fs.readFileSync(p, 'utf8');

// The block starts with {daemonKey === 'elections' && (
// Let's just remove anything from {daemonKey === 'elections' && ( until the nearest )} for that block
// Be careful not to remove too much.
txt = txt.replace(/\{daemonKey === 'elections' && \([\s\S]*?Heures fixes Elections[\s\S]*?\}\s*<\/div>\s*\)\}/, '');

fs.writeFileSync(p, txt, 'utf8');
console.log('Fixed elections daemonKey block');
