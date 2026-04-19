const fs = require('fs');

const path1 = 'app/(frontend)/radar-admin/settings/page.tsx';
let txt1 = fs.readFileSync(path1, 'utf8');

const sStart = '<section className="space-y-4 border-l-4 border-red-700 pl-4">';
const ix1 = txt1.indexOf(sStart);
if (ix1 === -1) {
    console.error("Could not find start");
    process.exit(1);
}

const ix2 = txt1.indexOf('</section>', ix1) + '</section>'.length;
if (ix2 === -1) {
    console.error("Could not find end");
    process.exit(1);
}

const sectionContent = txt1.substring(ix1, ix2);
txt1 = txt1.replace(sectionContent, ''); // remove it

const insertMarker = "                            </div>\r\n                        )}\r\n\r\n                        {activeTab === 'pipeline' && (";
const insertMarkerN = "                            </div>\n                        )}\n\n                        {activeTab === 'pipeline' && (";

let m = txt1.indexOf(insertMarker) !== -1 ? insertMarker : insertMarkerN;
if (txt1.indexOf(m) === -1) {
    console.error("Could not find marker");
    process.exit(1);
}

const newElectionsTab = `                        {activeTab === 'elections' && (
                            <div className="space-y-8">
                                <h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-6">Élections</h3>

                                <section className="space-y-6">
                                    <h4 className="text-sm font-black uppercase tracking-tight">Daemon Global Élections</h4>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="flex items-center justify-between p-4 bg-stone-50 border-4 border-stone-900">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Activation globale du Daemon Élections</span>
                                            <Toggle checked={form.daemon_elections_enabled !== 'false'} onChange={v => updateForm('daemon_elections_enabled', v ? 'true' : 'false')} />
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-stone-50 border-4 border-stone-900">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Intervalle régulier</span>
                                            <Toggle checked={form.daemon_elections_interval_enabled !== 'false'} onChange={v => updateForm('daemon_elections_interval_enabled', v ? 'true' : 'false')} />
                                        </div>
                                        <div className="flex items-center justify-between p-4 bg-stone-50 border-4 border-stone-900">
                                            <span className="text-[10px] font-black uppercase tracking-widest">Heures fixes programmées</span>
                                            <Toggle checked={form.daemon_elections_schedule_enabled === 'true'} onChange={v => updateForm('daemon_elections_schedule_enabled', v ? 'true' : 'false')} />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Heures programmées (ex: 08:00, 12:30)</label>
                                            <input type="text" value={form.daemon_elections_schedule_times || ''} onChange={e => updateForm('daemon_elections_schedule_times', e.target.value)} placeholder="08:00, 12:30" className="w-full bg-stone-50 border-4 border-stone-900 p-3 font-mono text-xs" />
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/radar/election-sync-manual', { method: 'POST' });
                                                const text = await res.text();
                                                alert('Result: ' + text);
                                            } catch (e) {
                                                alert('Error: ' + String(e));
                                            }
                                        }}
                                        className="bg-red-700 text-white px-4 py-3 border-4 border-stone-900 text-xs font-black uppercase tracking-widest hover:bg-stone-900 transition-colors"
                                    >
                                        LANCER SCAN ELECTION (MANUEL)
                                    </button>
                                </section>

${sectionContent}
                            </div>
                        )}

`;

txt1 = txt1.replace(m, newElectionsTab + m);

fs.writeFileSync(path1, txt1, 'utf8');
console.log('Settings done!');

// Now for daemon page app/(frontend)/radar-admin/daemon/page.tsx
const path2 = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt2 = fs.readFileSync(path2, 'utf8');

// 1. remove daemonElectionsEnabled, electionsScheduleEnabled, electionsIntervalEnabled, electionsScheduleTimes
txt2 = txt2.replace(/const \[daemonElectionsEnabled, setDaemonElectionsEnabled\] = useState\(false\);\n?/g, '');
txt2 = txt2.replace(/const \[electionsScheduleEnabled, setElectionsScheduleEnabled\] = useState\(false\);\n?/g, '');
txt2 = txt2.replace(/const \[electionsIntervalEnabled, setElectionsIntervalEnabled\] = useState\(true\);\n?/g, '');
txt2 = txt2.replace(/const \[electionsScheduleTimes, setElectionsScheduleTimes\] = useState<string\[\]>\(\[\]\);\n?/g, '');
txt2 = txt2.replace(/const \[newElectionScheduleTime, setNewElectionScheduleTime\] = useState\('09:00'\);\n?/g, '');

// Also remove setStatus dependencies on these removed variables:
txt2 = txt2.replace(/setDaemonElectionsEnabled\((.*?)\);\n?/g, '');
txt2 = txt2.replace(/setElectionsScheduleEnabled\((.*?)\);\n?/g, '');
txt2 = txt2.replace(/setElectionsIntervalEnabled\((.*?)\);\n?/g, '');
txt2 = txt2.replace(/setElectionsScheduleTimes\((.*?)\);\n?/g, '');

// 2. Remove "Scheduling ET/OU" large section. Wait, let's locate it exactly.
// It's under `<section className="space-y-4">` inside grid
const tsStart = '<h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-4">Scheduling ET/OU</h3>';
const idxSch = txt2.indexOf(tsStart);
if(idxSch !== -1) {
    // find section start before
    const secStart = txt2.lastIndexOf('<section className="space-y-4">', idxSch);
    if(secStart !== -1) {
        const secEnd = txt2.indexOf('</section>', idxSch) + '</section>'.length;
        txt2 = txt2.substring(0, secStart) + txt2.substring(secEnd);
    }
}

// 3. In Runtime & Actions, only display toggles for daemonRssEnabled, autoPilotEnabled, autoApproveEnabled.
// AND keep config rss button.
const rtStart = '<h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-4">Runtime & Actions</h3>';
const idxRt = txt2.indexOf(rtStart);
if (idxRt !== -1) {
    const p1 = txt2.substring(0, idxRt);
    const secEnd = txt2.indexOf('</section>', idxRt) + '</section>'.length;
    const p2 = txt2.substring(secEnd);
    
    // rewrite this section completely as per instructions
    const newRt = `<section className="space-y-4">
                                <h3 className="text-xl font-black uppercase tracking-tighter font-headline mb-4">Runtime & Actions</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="flex items-center justify-between p-4 bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)]">
                                        <span className="text-sm font-black uppercase tracking-widest text-stone-900">Activer Daemon RSS</span>
                                        <Toggle checked={daemonRssEnabled} onChange={setDaemonRssEnabled} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)]">
                                        <div>
                                            <span className="text-sm font-black uppercase tracking-widest block text-stone-900">Auto Pilot</span>
                                            <span className="text-[10px] font-bold text-stone-400">Diffusion queue</span>
                                        </div>
                                        <Toggle checked={autoPilotEnabled} onChange={setAutoPilotEnabled} />
                                    </div>
                                    <div className="flex items-center justify-between p-4 bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)]">
                                        <div>
                                            <span className="text-sm font-black uppercase tracking-widest block text-stone-900">Ghost Mode</span>
                                            <span className="text-[10px] font-bold text-stone-400">Auto-approve</span>
                                        </div>
                                        <Toggle checked={autoApproveEnabled} onChange={setAutoApproveEnabled} />
                                    </div>
                                </div>
                                <div className="mt-8 flex items-center gap-4 border-t-2 border-stone-100 pt-6">
                                    <button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/radar/daemon-run', { method: 'POST', body: JSON.stringify({ action: 'scan' }) });
                                                const txt = await res.text();
                                                alert(txt);
                                            } catch(e) {
                                                alert(String(e));
                                            }
                                        }}
                                        className="bg-red-700 text-white px-6 py-4 border-4 border-stone-900 text-sm font-black uppercase tracking-widest hover:bg-stone-900 transition-colors shadow-[4px_4px_0_0_rgba(28,25,23,1)]"
                                    >
                                        RUN MANUAL SCAN
                                    </button>
                                    <button
                                        onClick={() => window.location.href = '/radar-admin/settings'}
                                        className="bg-white text-stone-900 px-6 py-4 border-4 border-stone-900 text-sm font-black uppercase tracking-widest hover:bg-stone-50 transition-colors shadow-[4px_4px_0_0_rgba(28,25,23,1)]"
                                    >
                                        Configurer RSS
                                    </button>
                                </div>
                            </section>`;
    txt2 = p1 + newRt + p2;
}

// 5. In daemonProfiles, remove elections logic
txt2 = txt2.replace(/elections: {[^}]*},\n?/g, '');
txt2 = txt2.replace(/election_interval_hours: [0-9.]+,\n?/g, '');
txt2 = txt2.replace(/<div className="flex items-center gap-2">\s*<input type="number"[^>]*election_interval_hours[^>]*\/>\s*<span[^>]*>h \(Élections\)<\/span>\s*<\/div>/g, '');

// 6. remove elections from allowed rules daemon types
txt2 = txt2.replace(/<option value="elections">Élections<\/option>/g, '');

fs.writeFileSync(path2, txt2, 'utf8');
console.log('Daemon page done!');
