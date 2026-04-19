const fs = require('fs');
const p = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt = fs.readFileSync(p, 'utf8');

txt = txt.replace(/\['rss', 'publisher', 'elections'\]/g, "['rss', 'publisher']");
txt = txt.replace(/electionsEnabled:\s*boolean;/g, "");

fs.writeFileSync(p, txt, 'utf8');
