const fs = require('fs');
const path = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

const snipStart = '    const addElectionScheduleTime = () => {';
const ix = txt.indexOf(snipStart);
if(ix !== -1) {
  const ix2 = txt.indexOf('};', ix) + 2;
  txt = txt.substring(0, ix) + txt.substring(ix2);
}

fs.writeFileSync(path, txt, 'utf8');
console.log('Gone');