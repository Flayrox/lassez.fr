import React, { useState } from 'react';

export function TestIATab() {
    const [text, setText] = useState('');
    const [results, setResults] = useState<any[] | null>(null);
    const [isTesting, setIsTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        if (!text.trim()) return;
        setIsTesting(true);
        setError(null);
        setResults(null);
        try {
            const res = await fetch('/api/radar/test-ia', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ textToTest: text })
            });
            const data = await res.json();
            if (data.success) {
                setResults(data.results);
            } else {
                setError(data.error || 'Erreur inconnue');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="animate-in fade-in zoom-in-95 duration-1000">
            <div className="bg-white rounded-[3.5rem] border-[12px] border-stone-900 p-10 md:p-20 shadow-[32px_32px_0px_0px_rgba(28,25,23,1)] relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-600 via-fuchsia-600 to-rose-600" />
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-600/5 rounded-full" />
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-10 mb-20 border-b-8 border-stone-100 pb-12 relative">
                    <div>
                        <div className="flex items-center gap-4 mb-6">
                            <span className="text-5xl">🧪</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] bg-stone-900 text-white px-5 py-2 rounded-full">SIMULATEUR DE CONSCIENCE</span>
                        </div>
                        <h3 className="text-6xl font-black uppercase tracking-tighter italic leading-none">Labo de Gemini</h3>
                        <p className="text-base font-bold text-stone-400 mt-4 uppercase tracking-[0.1em] border-l-4 border-purple-500 pl-6">Prototypez et débuggez les neurones sémantiques du Radar en temps réel</p>
                    </div>
                    <div className="flex items-center gap-3 group/chip">
                        <div className="w-4 h-4 bg-purple-600 rounded-full animate-ping" />
                        <div className="bg-stone-950 text-white px-8 py-4 rounded-3xl font-black uppercase tracking-widest text-xs shadow-2xl transition-transform group-hover/chip:scale-105">FLASH_3.1_ENGINE</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-20">
                    <div className="space-y-12">
                        <div className="relative group/field">
                            <label className="absolute -top-4 left-10 bg-white px-4 text-xs font-black uppercase tracking-widest text-purple-600 z-10 transition-transform group-focus-within/field:-translate-y-2">Entrée Sémantique (Dépêche Brut/OSINT)</label>
                            <textarea 
                                value={text}
                                onChange={e => setText(e.target.value)}
                                rows={16}
                                className="w-full bg-stone-50 border-8 border-stone-100 rounded-[2.5rem] p-12 font-mono text-sm leading-relaxed text-stone-800 focus:bg-white focus:outline-none focus:border-purple-600 transition-all resize-none shadow-inner"
                                placeholder="Collez ici un flux brut pour tester l'intelligence..."
                            />
                        </div>
                        <button 
                            onClick={handleTest}
                            disabled={isTesting || !text.trim()}
                            className="w-full px-12 py-8 bg-purple-600 text-white font-black uppercase tracking-widest rounded-[2rem] border-8 border-stone-900 shadow-[16px_16px_0px_0px_rgba(0,0,0,0.1)] hover:bg-purple-700 hover:shadow-none transition-all active:translate-y-4 disabled:opacity-30 flex items-center justify-center gap-6 group"
                        >
                            {isTesting ? (
                                <div className="flex items-center gap-4">
                                    <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>GÉMINI COGITE...</span>
                                </div>
                            ) : (
                                <>
                                    <span className="text-xl">LANCER LE DÉCODAGE</span>
                                    <span className="text-3xl group-hover:rotate-45 transition-transform">🚀</span>
                                </>
                            )}
                        </button>
                        {error && (
                            <div className="p-8 rounded-[1.5rem] bg-rose-50 border-8 border-rose-100 text-rose-600 text-sm font-black font-mono shadow-inner">
                                [FATAL_EXCEPTION_X3]: {error}
                            </div>
                        )}
                    </div>
                    
                    <div className="relative min-h-[500px] flex flex-col group/result">
                        <label className="absolute -top-4 left-10 bg-white px-4 text-xs font-black uppercase tracking-widest text-stone-400 z-10">Sortie Moléculaire (Architecture JSON)</label>
                        <div className="bg-stone-900 text-purple-300 font-mono text-sm rounded-[2.5rem] p-12 border-8 border-stone-900 flex-1 shadow-[24px_24px_60px_rgba(0,0,0,0.2)] overflow-hidden relative group-hover/result:shadow-[24px_24px_60px_rgba(147,51,234,0.15)] transition-shadow">
                             <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-amber-500" />
                            {isTesting ? (
                                <div className="flex flex-col items-center justify-center h-full gap-8 text-purple-400/50">
                                    <div className="w-20 h-20 border-8 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.5em] animate-pulse">DÉCODAGE QUANTIQUE</span>
                                </div>
                            ) : results ? (
                                <pre className="whitespace-pre-wrap max-h-full overflow-y-auto custom-scrollbar leading-relaxed">{JSON.stringify(results, null, 2)}</pre>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-stone-800 opacity-20 border-8 border-dashed border-stone-800 rounded-[2rem] m-6">
                                    <span className="text-8xl mb-8">🧬</span>
                                    <p className="text-xs font-black uppercase tracking-[0.5em]">En attente de matière</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}