const fs = require('fs');

const oldStr = `                <section className="bg-white border-4 border-stone-900 shadow-[10px_10px_0px_0px_#1A1C1C] p-8 space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <h2 className="text-2xl font-black uppercase tracking-tighter font-headline">Runtime & Actions</h2>`;

const newStr = `                <section className="bg-white border-4 border-stone-900 shadow-[10px_10px_0px_0px_#1A1C1C] p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center justify-between w-full">
                            <h2 className="text-2xl font-black uppercase tracking-tighter font-headline flex items-center gap-3">
                                Cerveau Cortex & Formats
                            </h2>
                            <button
                                onClick={async () => {
                                    setIsTestingFlows(true);
                                    try {
                                        const res = await fetch('/api/radar/test-flows', { method: 'POST' });
                                        const data = await res.json();
                                        if (data.success) alert(data.message);
                                    } catch (e) {
                                        console.error(e);
                                    } finally {
                                        setIsTestingFlows(false);
                                    }
                                }}
                                disabled={isTestingFlows}
                                className="bg-stone-900 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-stone-700 transition-colors"
                            >
                                {isTestingFlows ? 'Test en cours...' : 'Diagnostic Flux'}
                            </button>
                        </div>
                    </div>

                    <div className="bg-stone-50 border-4 border-stone-900 p-6 space-y-6">
                         <h3 className="text-lg font-black uppercase tracking-tighter font-headline mb-4">Moteur De Pensee</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Modele Fallback (Defaut)</label>
                                    <select
                                        value={cortexVars.ai_model_main}
                                        onChange={e => setCortexVars({ ...cortexVars, ai_model_main: e.target.value })}
                                        className="w-full bg-white border-4 border-stone-900 p-3 font-black text-xs"
                                    >
                                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Preview)</option>
                                        <option value="gemini-3-flash-preview">Gemini 3.0 Flash</option>
                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-stone-500 mb-1 block">Prompt Systeme (Brain)</label>
                                    <textarea
                                        value={cortexVars.ai_prompt}
                                        onChange={e => setCortexVars({ ...cortexVars, ai_prompt: e.target.value })}
                                        rows={6}
                                        placeholder="Directives systemes (ton, personnalite)"
                                        className="w-full bg-white border-4 border-stone-900 p-3 text-xs"
                                    />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-stone-500 mb-1 flex items-center justify-between">
                                        Pre-Filtre (Le Tamis) - Pertinence
                                    </label>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase mb-2">Definit ce qu'il jette de ce qu'il garde (ROI = Oui/Non)</p>
                                    <textarea
                                        value={cortexVars.ai_prompt_relevance}
                                        onChange={e => setCortexVars({ ...cortexVars, ai_prompt_relevance: e.target.value })}
                                        rows={6}
                                        placeholder="Le filtre a dechets entrants..."
                                        className="w-full bg-white border-4 border-stone-900 p-3 text-xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-xl font-black uppercase tracking-tighter font-headline mt-6">Pipelines Editoriaux</h3>

                    {/* Format Pipelines */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* ALERTE INFO */}
                        <div className="border-4 border-red-700 bg-white p-4 space-y-4">
                            <div className="flex justify-between items-center bg-red-700 text-white px-3 py-2 -mx-4 -mt-4 mb-2">
                                <h3 className="text-xs font-black uppercase tracking-widest">🔴 ALERTE INFO</h3>
                                <Toggle checked={cortexVars.ai_prompt_breaking_enabled === 'true'} onChange={v => setCortexVars({ ...cortexVars, ai_prompt_breaking_enabled: v ? 'true' : 'false' })} />
                            </div>
                            <select
                                value={cortexVars.ai_model_breaking}
                                onChange={e => setCortexVars({ ...cortexVars, ai_model_breaking: e.target.value })}
                                className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-[10px] uppercase"
                            >
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            </select>
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase">
                                <input type="checkbox" checked={cortexVars.google_search_breaking_enabled === 'true'} onChange={e => setCortexVars({ ...cortexVars, google_search_breaking_enabled: e.target.checked ? 'true' : 'false' })} />
                                Activer Recherche Google Web 
                            </label>
                            <textarea
                                value={cortexVars.ai_prompt_breaking}
                                onChange={e => setCortexVars({ ...cortexVars, ai_prompt_breaking: e.target.value })}
                                rows={8}
                                disabled={cortexVars.ai_prompt_breaking_enabled !== 'true'}
                                className="w-full bg-stone-50 border-2 border-stone-900 p-2 text-[10px] disabled:opacity-50"
                            />
                        </div>

                        {/* FAIT DU JOUR */}
                        <div className="border-4 border-blue-700 bg-white p-4 space-y-4">
                            <div className="flex justify-between items-center bg-blue-700 text-white px-3 py-2 -mx-4 -mt-4 mb-2">
                                <h3 className="text-xs font-black uppercase tracking-widest">📌 FAIT DU JOUR</h3>
                                <Toggle checked={cortexVars.ai_prompt_standard_enabled === 'true'} onChange={v => setCortexVars({ ...cortexVars, ai_prompt_standard_enabled: v ? 'true' : 'false' })} />
                            </div>
                            <select
                                value={cortexVars.ai_model_standard}
                                onChange={e => setCortexVars({ ...cortexVars, ai_model_standard: e.target.value })}
                                className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-[10px] uppercase"
                            >
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            </select>
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase">
                                <input type="checkbox" checked={cortexVars.google_search_standard_enabled === 'true'} onChange={e => setCortexVars({ ...cortexVars, google_search_standard_enabled: e.target.checked ? 'true' : 'false' })} />
                                Activer Recherche Google Web 
                            </label>
                            <textarea
                                value={cortexVars.ai_prompt_standard}
                                onChange={e => setCortexVars({ ...cortexVars, ai_prompt_standard: e.target.value })}
                                rows={8}
                                disabled={cortexVars.ai_prompt_standard_enabled !== 'true'}
                                className="w-full bg-stone-50 border-2 border-stone-900 p-2 text-[10px] disabled:opacity-50"
                            />
                        </div>

                        {/* DECRYPTAGE */}
                        <div className="border-4 border-stone-900 bg-white p-4 space-y-4">
                            <div className="flex justify-between items-center bg-stone-900 text-white px-3 py-2 -mx-4 -mt-4 mb-2">
                                <h3 className="text-xs font-black uppercase tracking-widest">🔎 DECRYPTAGE</h3>
                                <Toggle checked={cortexVars.ai_prompt_decrypt_enabled === 'true'} onChange={v => setCortexVars({ ...cortexVars, ai_prompt_decrypt_enabled: v ? 'true' : 'false' })} />
                            </div>
                            <select
                                value={cortexVars.ai_model_decrypt}
                                onChange={e => setCortexVars({ ...cortexVars, ai_model_decrypt: e.target.value })}
                                className="w-full bg-stone-50 border-2 border-stone-900 p-2 font-black text-[10px] uppercase"
                            >
                                <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            </select>
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase">
                                <input type="checkbox" checked={cortexVars.google_search_decrypt_enabled === 'true'} onChange={e => setCortexVars({ ...cortexVars, google_search_decrypt_enabled: e.target.checked ? 'true' : 'false' })} />
                                Activer Recherche Google Web 
                            </label>
                            <textarea
                                value={cortexVars.ai_prompt_decrypt}
                                onChange={e => setCortexVars({ ...cortexVars, ai_prompt_decrypt: e.target.value })}
                                rows={8}
                                disabled={cortexVars.ai_prompt_decrypt_enabled !== 'true'}
                                className="w-full bg-stone-50 border-2 border-stone-900 p-2 text-[10px] disabled:opacity-50"
                            />
                        </div>
                    </div>
                </section>\n\n` + oldStr;

let c = fs.readFileSync('app/(frontend)/radar-admin/daemon/page.tsx', 'utf8');
if (c.includes(oldStr)) {
    console.log('Found string!');
    c = c.replace(oldStr, newStr);
    fs.writeFileSync('app/(frontend)/radar-admin/daemon/page.tsx', c);
    console.log('SUCCESS INJECTION!');
} else {
    console.log('String not found.');
}
