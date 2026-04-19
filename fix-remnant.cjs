const fs = require('fs');
const path = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/ *if \(!Number\.isFinite\(electionInt\) \|\| electionInt < 0\.1\) return `Elections interval invalide pour \$\{daemonKey\} \(min 0\.1h\)\.`;\r?\n/g, '');
txt = txt.replace(/ *if \(daemonElectionsEnabled && !electionsIntervalEnabled && !electionsScheduleEnabled\) return 'Elections: active au moins un declencheur \(intervalle et\/ou heures fixes\)\.';\r?\n/g, '');
txt = txt.replace(/ *if \(electionsScheduleEnabled && electionsScheduleTimes\.length === 0\) return 'Ajoute au moins une heure Elections en mode heures fixes\.';\r?\n/g, '');
txt = txt.replace(/ *const electionInt = Number\(p\.election_interval_hours\);\r?\n/g, '');

fs.writeFileSync(path, txt, 'utf8');
console.log('Fixed');