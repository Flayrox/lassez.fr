const fs = require('fs');

let content = fs.readFileSync('app/(frontend)/radar-admin/settings/page.tsx', 'utf8');

// 1. Remove interval and schedule from Global Elections Daemon block
content = content.replace(
  /<div className="flex items-center justify-between p-4 bg-stone-50 border-4 border-stone-900">\s*<span className="text-\[10px\] font-black uppercase tracking-widest">Intervalle régulier<\/span>\s*<Toggle checked=\{form\.daemon_elections_interval_enabled !== 'false'\} onChange=\{v => updateForm\('daemon_elections_interval_enabled', v \? 'true' : 'false'\)\} \/>\s*<\/div>[\s\S]*?<input type="text" value=\{form\.daemon_elections_schedule_times \|\| ''\} onChange=\{e => updateForm\('daemon_elections_schedule_times', e\.target\.value\)\} placeholder="08:00, 12:30" className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" \/>\s*<\/div>/,
  ''
);

// 2. Remove Live Mode and Pull Interval from the Wizard
content = content.replace(
  /<div className="flex items-center justify-between p-3 bg-stone-50 border-2 border-stone-900">\s*<span className="text-\[10px\] font-black uppercase">Activer mode live<\/span>\s*<Toggle checked=\{wizardLiveEnabled\} onChange=\{setWizardLiveEnabled\} \/>\s*<\/div>/,
  ''
);

content = content.replace(
  /<div>\s*<label className="text-\[10px\] font-black uppercase text-stone-500 block mb-1">Pull interval live \(minutes\)<\/label>\s*<input type="number" min="2" value=\{wizardPollMin\} onChange=\{e => setWizardPollMin\(Number\(e\.target\.value \|\| 2\)\)\} className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-xs" \/>\s*<\/div>/,
  ''
);

// 3. Remove individual daemon intervals from the Slug configuration map
content = content.replace(
  /<div className="flex items-center justify-between">\s*<span className="text-\[10px\] font-black uppercase">Live minutes<\/span>[\s\S]*?<div className="flex items-center justify-between p-2 bg-white border-2 border-stone-900">\s*<span className="text-\[10px\] font-black uppercase">Sync locked<\/span>\s*<Toggle checked=\{daemonCfg\.sync_locked === true \|\| daemonCfg\.sync_locked === 'true'\} onChange=\{v => updateDaemonCfg\(slug, 'sync_locked', v\)\} \/>\s*<\/div>/g,
  ''
);

fs.writeFileSync('app/(frontend)/radar-admin/settings/page.tsx', content);
console.log('Cleaned up Daemon inputs from Settings');
