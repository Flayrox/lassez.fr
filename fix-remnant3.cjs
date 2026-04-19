const fs = require('fs');
const path = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/ *daemon_elections_enabled:.*?\n/g, '');
txt = txt.replace(/ *daemon_elections_interval_enabled:.*?\n/g, '');
txt = txt.replace(/ *daemon_elections_schedule_enabled:.*?\n/g, '');
txt = txt.replace(/ *daemon_elections_schedule_times:.*?\n/g, '');

// Also remove from initialize states
txt = txt.replace(/ *setDaemonElectionsEnabled\(.*?\);\n/g, '');
txt = txt.replace(/ *setElectionsIntervalEnabled\(.*?\);\n/g, '');
txt = txt.replace(/ *setElectionsScheduleEnabled\(.*?\);\n/g, '');
txt = txt.replace(/ *setElectionsScheduleTimes\(.*?\);\n/g, '');

fs.writeFileSync(path, txt, 'utf8');
console.log('Gone 2');