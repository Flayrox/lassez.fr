const fs = require('fs');
const path = 'app/(frontend)/radar-admin/daemon/page.tsx';
let txt = fs.readFileSync(path, 'utf8');

// I will just find and wipe out "Scheduling ET/OU" section.
const tStart = '<h2 className="text-2xl font-black uppercase tracking-tighter font-headline">Scheduling ET/OU</h2>';
const idxSch = txt.indexOf(tStart);
if(idxSch !== -1) {
    const secStart = txt.lastIndexOf('<section', idxSch);
    let secEnd = txt.indexOf('</section>', idxSch);
    if(secStart !== -1 && secEnd !== -1) {
        secEnd += '</section>'.length;
        txt = txt.substring(0, secStart) + txt.substring(secEnd);
    }
}

// Runtime & Actions
const rtStart = '<h2 className="text-2xl font-black uppercase tracking-tighter font-headline mb-4">Runtime & Actions</h2>';
const idxRt = txt.indexOf(rtStart);
if (idxRt !== -1) {
    const secStart = txt.lastIndexOf('<section', idxRt);
    let secEnd = txt.indexOf('</section>', idxRt);
    if(secStart !== -1 && secEnd !== -1) {
        secEnd += '</section>'.length;
        txt = txt.substring(0, secStart) + `<section className="space-y-4">
    <h2 className="text-2xl font-black uppercase tracking-tighter font-headline mb-4">Runtime & Actions</h2>
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
                setManualAction('scan');
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
</section>` + txt.substring(secEnd);
    }
}

// Remove remaining elections logic
// elections array in state profiles
txt = txt.replace(/,\s*elections: \{\s*max_articles: '3',\s*rss_lookback_hours: '24',\s*min_delay_min: '60',\s*max_delay_min: '180',\s*scan_interval_hours: '1',\s*election_interval_hours: '1'\s*\}/, '');

// Also remove type from DaemonType
txt = txt.replace(/'rss' \| 'publisher' \| 'elections'/, "'rss' | 'publisher'");
txt = txt.replace(/'rss', 'publisher', 'elections'/, "'rss', 'publisher'");

// Tuning rules overrides
txt = txt.replace(/\s*election_interval_hours\?: number;\s*/g, '\n');
txt = txt.replace(/,\s*election_interval_hours: [^,}]*/g, '');
txt = txt.replace(/,\s*election_interval_hours: [^\}]*/g, '');
txt = txt.replace(/<option value="elections">Élections<\/option>/g, '');

// Remove testing buttons
const testStart = '<div className="flex items-center gap-4 flex-wrap border-t-4 border-stone-100 pt-6">';
const idxTest = txt.indexOf(testStart);
if(idxTest !== -1) {
    const ix2 = txt.indexOf('</div>', idxTest) + '</div>'.length;
    // Actually, just remove the election test button
    txt = txt.replace(/<button[^>]*onClick=\{[^}]*action: 'elections'[^}]*\}[^>]*>[\s\S]*?<\/button>/, '');
}

fs.writeFileSync(path, txt, 'utf8');
console.log('Fixed UI completely');
