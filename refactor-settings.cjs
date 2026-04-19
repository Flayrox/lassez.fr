const fs = require('fs');

const path1 = 'app/(frontend)/radar-admin/settings/page.tsx';
let txt1 = fs.readFileSync(path1, 'utf8');

const electionSectionStart = `<section className="space-y-4 border-l-4 border-red-700 pl-4">\n                                    <div>\n                                        <h4 className="text-sm font-black uppercase tracking-tight">Elections long-terme (multi-slugs)</h4>`;
const ix1 = txt1.indexOf(electionSectionStart);
if (ix1 === -1) {
    console.error("Could not find start of election section in settings");
    process.exit(1);
}

// find closing </section>
let depth = 1;
let ix2 = ix1 + 10;
while(ix2 < txt1.length) {
    const nextClose = txt1.indexOf('</section>', ix2);
    const nextOpen = txt1.indexOf('<section', ix2);
    
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
        // nested section? probably not, but just find the immediate </section>
        // the structure has no nested sections inside this particular block
    }
    ix2 = nextClose + 10;
    break;
}

const sectionContent = txt1.substring(ix1, ix2);

txt1 = txt1.replace(sectionContent, '');

const insertionPoint = `                            </div>\n                        )}\n\n                        {activeTab === 'pipeline' && (`

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

txt1 = txt1.replace(insertionPoint, newElectionsTab + insertionPoint);

fs.writeFileSync(path1, txt1, 'utf8');
console.log('Settings page updated.');
