'use client';

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
                setError(data.error || 'Unknown error');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-white font-sans">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex flex-col">
                    <h3 className="text-[11px] font-bold text-black uppercase tracking-tighter">Cortex neural simulator</h3>
                    <p className="text-[10px] text-slate-400">Prompt engineering & semantic debugging</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_3px_rgba(16,185,129,0.5)]" />
                    <span className="text-[10px] font-mono font-bold text-black">GEMINI_1.5_PRO</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 flex-1 divide-x divide-slate-100 min-h-[500px]">
                {/* Input */}
                <div className="flex flex-col p-4 space-y-4">
                    <div className="flex-1 flex flex-col space-y-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Raw OSINT feed input</label>
                        <textarea 
                            value={text}
                            onChange={e => setText(e.target.value)}
                            className="flex-1 w-full bg-slate-50 border border-slate-200 rounded-sm p-4 font-mono text-[11px] leading-relaxed text-black focus:bg-white focus:border-black outline-none transition-all resize-none"
                            placeholder="Paste raw data here to simulate extraction..."
                        />
                    </div>
                    <button 
                        onClick={handleTest}
                        disabled={isTesting || !text.trim()}
                        className="w-full h-9 bg-black text-white font-bold text-[11px] rounded-sm hover:bg-zinc-800 disabled:opacity-20 transition-all flex items-center justify-center gap-2"
                    >
                        {isTesting ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                <span>Simulating...</span>
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                                Run neural decoding
                            </>
                        )}
                    </button>
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-bold font-mono">
                            [ERROR]: {error}
                        </div>
                    )}
                </div>

                {/* Output */}
                <div className="flex flex-col p-4 bg-slate-50/50">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-2">Neural output (JSON architecture)</label>
                    <div className="flex-1 bg-white border border-slate-200 rounded-sm overflow-hidden relative flex flex-col shadow-inner">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-emerald-500 via-blue-500 to-purple-500 opacity-50" />
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            {isTesting ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
                                    <div className="w-6 h-6 border-2 border-slate-200 border-t-black rounded-full animate-spin" />
                                    <span className="text-[9px] font-bold uppercase tracking-widest animate-pulse">Processing...</span>
                                </div>
                            ) : results ? (
                                <pre className="font-mono text-[11px] text-slate-600 whitespace-pre-wrap">{JSON.stringify(results, null, 2)}</pre>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-200 border-2 border-dashed border-slate-100 rounded-sm m-4">
                                    <span className="material-symbols-outlined text-[48px] opacity-20">biotech</span>
                                    <p className="text-[9px] font-bold uppercase tracking-widest mt-2">Waiting for neural matter</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}