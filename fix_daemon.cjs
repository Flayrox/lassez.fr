const fs = require('fs');
const p = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt = fs.readFileSync(p, 'utf8');

// There is a remnant div block containing daemonElectionsEnabled
txt = txt.replace(/<div className="flex items-center justify-between p-3 bg-stone-5[^>]*>[\s\S]*?<span className="text-xs font-black uppercase">Daemon Electi[\s\S]*?<\/div>/g, '');

// just blanket remove lines with daemonElectionsEnabled
const lines = txt.split('\n');
const fixed = lines.filter(l => !l.includes('daemonElectionsEnabled') && !l.includes('Daemon Electi')).join('\n');

fs.writeFileSync(p, fixed, 'utf8');
console.log('Fixed UI block');
