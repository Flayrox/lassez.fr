const fs = require('fs');
let c = fs.readFileSync('app/(frontend)/radar-admin/daemon/page.tsx', 'utf8');

let startIndex = c.indexOf('{profilesOpen && (');
let endIndex = c.lastIndexOf('</DashboardLayout>');

let badChunk = c.substring(startIndex, endIndex);

const newModal = `{profilesOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="w-full max-w-5xl bg-stone-50 border-4 border-stone-900 shadow-[16px_16px_0px_0px_#1A1C1C] p-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-8 pb-4 border-b-4 border-stone-900">
                            <div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter font-headline flex items-center gap-3">
                                    <span className="text-xl">⚙️</span> Configuration Individuelle des Daemons
                                </h3>
                                <p className="text-xs font-bold text-stone-500 uppercase mt-2">Precision du Cycle de Vie (Scrape & Diffusion)</p>
                            </div>
                            <button onClick={() => setProfilesOpen(false)} className="px-6 py-2 bg-stone-900 text-white hover:bg-stone-700 transition-colors text-xs font-black uppercase tracking-widest border-2 border-stone-900 shadow-[4px_4px_0px_0px_#1A1C1C]">
                                Sauvegarder & Fermer
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* RSS DAEMON - LE TRACTEUR */}
                            <div className="bg-white border-4 border-stone-900 p-6 flex flex-col gap-6">
                                <div className="bg-blue-600 text-white px-4 py-2 -mx-6 -mt-6 border-b-4 border-stone-900 mb-2 flex justify-between items-center">
                                    <h4 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">📡 Le Collecteur (RSS)</h4>
                                    <span className="text-[10px] bg-stone-900 px-2 py-1 font-bold uppercase border-2 border-stone-900">Inbound</span>
                                </div>
                                <p className="text-[10px] text-stone-500 uppercase font-bold">Gere la frequence de balayage des sources et le volume absorbe.</p>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-700 border-b-2 border-stone-200 pb-2">📅 Planification du Crawl</h5>
                                    
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase">Intervalle Regulier</span>
                                        <Toggle checked={rssIntervalEnabled} onChange={setRssIntervalEnabled} />
                                    </div>
                                    {rssIntervalEnabled && (
                                        <div className="pl-4 border-l-4 border-blue-600 space-y-1">
                                            <label className="text-[10px] font-black uppercase text-stone-500 block">Frequence (Heures)</label>
                                            <input type="number" step="0.1" value={daemonProfiles.rss.scan_interval_hours} onChange={e => updateDaemonProfile('rss', 'scan_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-4">
                                        <span className="text-[10px] font-black uppercase">Heures Fixes (Horloge)</span>
                                        <Toggle checked={scheduleEnabled} onChange={setScheduleEnabled} />
                                    </div>
                                    {scheduleEnabled && (
                                        <div className="pl-4 border-l-4 border-blue-600 space-y-2">
                                            <div className="flex gap-2 items-stretch">
                                                <div className="flex-1">
                                                    <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Nouvelle heure</label>
                                                    <input type="time" value={newScheduleTime} onChange={e => setNewScheduleTime(e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                                </div>
                                                <button onClick={addScheduleTime} className="px-4 py-2 mt-auto bg-stone-900 text-white font-black text-xs uppercase hover:bg-stone-700 transition-colors">+ Ajouter</button>
                                            </div>
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {scheduleTimes.length === 0 && <span className="text-xs text-stone-400 italic">Aucune heure fixee</span>}
                                                {scheduleTimes.map(t => (
                                                    <button key={\`rss-\${t}\`} onClick={() => removeScheduleTime(t)} className="px-3 py-1 bg-white hover:bg-red-100 hover:text-red-700 hover:border-red-700 text-stone-900 border-2 border-stone-900 text-[10px] font-black transition-colors group flex items-center gap-1">
                                                        {t} <span className="text-stone-400 group-hover:text-red-700">✕</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-blue-700 border-b-2 border-stone-200 pb-2">🧱 Limites d'Absorption</h5>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Articles / Scan</label>
                                            <input type="number" value={daemonProfiles.rss.max_articles} onChange={e => updateDaemonProfile('rss', 'max_articles', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs focus:ring-0" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Lookback Historique (h)</label>
                                            <input type="number" value={daemonProfiles.rss.rss_lookback_hours} onChange={e => updateDaemonProfile('rss', 'rss_lookback_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs focus:ring-0" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* PUBLISHER DAEMON - LA MACHINE A ECRIRE */}
                            <div className="bg-white border-4 border-stone-900 p-6 flex flex-col gap-6">
                                <div className="bg-emerald-600 text-white px-4 py-2 -mx-6 -mt-6 border-b-4 border-stone-900 mb-2 flex justify-between items-center">
                                    <h4 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">🚀 Le Diffuseur (Publisher)</h4>
                                    <span className="text-[10px] bg-stone-900 px-2 py-1 font-bold uppercase border-2 border-stone-900">Outbound</span>
                                </div>
                                <p className="text-[10px] text-stone-500 uppercase font-bold">Gere la cadence de publication, les delais et le rythme d'ecriture.</p>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 border-b-2 border-stone-200 pb-2">⚡ Cadence de Publication</h5>
                                    
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Intervalle entre Cycles (h)</label>
                                        <input type="number" step="0.1" value={daemonProfiles.publisher.scan_interval_hours} onChange={e => updateDaemonProfile('publisher', 'scan_interval_hours', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Articles / Cycle (Limite Session)</label>
                                        <input type="number" value={daemonProfiles.publisher.max_articles} onChange={e => updateDaemonProfile('publisher', 'max_articles', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                    </div>
                                </div>

                                <div className="space-y-4 bg-stone-50 border-2 border-stone-200 p-4">
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-700 border-b-2 border-stone-200 pb-2">⏱ Delais & Anti-Spam</h5>
                                    <p className="text-[9px] font-bold text-stone-400 mb-2 uppercase leading-tight">Assure une repartition organique des publications et simule une activite humaine.</p>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Min Delay (minutes)</label>
                                            <input type="number" value={daemonProfiles.publisher.min_delay_min} onChange={e => updateDaemonProfile('publisher', 'min_delay_min', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-stone-500 block mb-1">Max Delay (minutes)</label>
                                            <input type="number" value={daemonProfiles.publisher.max_delay_min} onChange={e => updateDaemonProfile('publisher', 'max_delay_min', e.target.value)} className="w-full bg-white border-2 border-stone-900 p-2 font-black text-xs" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="mt-6 bg-amber-50 border-4 border-amber-400 p-4 font-black flex items-center justify-center gap-2">
                            <span className="text-xl">⚠️</span>
                            <span className="text-[10px] uppercase text-amber-900 tracking-widest">
                                N'oubliez pas : Les modifications prendront effet apres avoir clique sur "Enregistrer" dans la section principale.
                            </span>
                        </div>
                    </div>
                </div>
            )}
`;

c = c.substring(0, startIndex) + newModal + c.substring(endIndex - 1);
fs.writeFileSync('app/(frontend)/radar-admin/daemon/page.tsx', c);
console.log('Fixed file successfully!');
