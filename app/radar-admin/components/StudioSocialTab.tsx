import React, { useState, useEffect } from 'react';

export function StudioSocialTab() {
    const [text, setText] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [drafts, setDrafts] = useState<any[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isBroadcasting, setIsBroadcasting] = useState(false);

    const fetchDrafts = async () => {
        try {
            const res = await fetch('/api/radar/social-custom');
            const data = await res.json();
            if (data.success) setDrafts(data.drafts);
        } catch (e) {}
    };

    useEffect(() => {
        fetchDrafts();
    }, []);

    const handlePost = async (broadcastNow: boolean) => {
        if (!text) return;
        if (broadcastNow) setIsBroadcasting(true);
        else setIsSaving(true);

        try {
            const res = await fetch('/api/radar/social-custom', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, image_url: imageUrl, broadcast_now: broadcastNow })
            });
            const data = await res.json();
            if (data.success) {
                if (!broadcastNow) {
                    setText('');
                    setImageUrl('');
                }
                fetchDrafts();
            } else {
                alert(data.error);
            }
        } catch (e) {
            alert("Erreur réseau");
        } finally {
            setIsSaving(false);
            setIsBroadcasting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                <div className="bg-white rounded-[3rem] border-8 border-stone-900 p-10 md:p-14 shadow-[24px_24px_0px_0px_rgba(28,25,23,1)] relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                    <div className="flex items-center gap-6 mb-12 border-b-4 border-stone-100 pb-8">
                        <div className="w-16 h-16 bg-rose-600 rounded-[1.5rem] flex items-center justify-center text-white text-3xl shadow-xl shadow-rose-200">📣</div>
                        <div>
                            <h3 className="text-4xl font-black uppercase tracking-tighter italic leading-none">Flash Manuel</h3>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 mt-2">DÉPASSEZ L'ORDINATEUR • PRENEZ LA MAIN</p>
                        </div>
                    </div>
                    
                    <div className="space-y-8">
                        <div className="relative group/field">
                            <label className="absolute -top-3 left-8 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-rose-600 z-10 transition-transform group-focus-within/field:-translate-y-1">Le Message</label>
                            <textarea 
                                value={text}
                                onChange={e => setText(e.target.value)}
                                rows={10}
                                className="w-full bg-stone-50 border-4 border-stone-100 rounded-[2rem] p-10 font-bold text-lg leading-relaxed text-stone-800 focus:border-rose-500 focus:bg-white focus:outline-none transition-all resize-none shadow-inner"
                                placeholder="Que voulez-vous dire au monde ?"
                            />
                        </div>
                        <div className="relative group/field">
                            <label className="absolute -top-3 left-8 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-stone-400 z-10">URL Média (Image/Vidéo)</label>
                            <div className="relative">
                                <input 
                                    type="text"
                                    value={imageUrl}
                                    onChange={e => setImageUrl(e.target.value)}
                                    className="w-full bg-stone-50 border-4 border-stone-100 rounded-3xl px-10 py-6 font-black text-stone-800 focus:border-rose-500 focus:bg-white focus:outline-none transition-all"
                                    placeholder="https://votre-image.jpg"
                                />
                                {imageUrl && <button onClick={() => setImageUrl('')} className="absolute right-6 top-1/2 -translate-y-1/2 bg-stone-950 text-white w-8 h-8 rounded-full text-xs flex items-center justify-center hover:bg-rose-600 transition-all scale-110 shadow-lg">✕</button>}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-6 pt-6">
                            <button 
                                onClick={() => handlePost(false)}
                                disabled={isSaving || isBroadcasting || !text}
                                className="px-10 py-6 border-8 border-stone-900 font-black uppercase tracking-widest text-sm bg-white hover:bg-stone-50 transition-all active:translate-y-2 disabled:opacity-30 flex items-center gap-3"
                            >
                                {isSaving ? <span className="w-4 h-4 border-4 border-stone-200 border-t-rose-500 rounded-full animate-spin" /> : '💾'}
                                <span>Brouillon</span>
                            </button>
                            <button 
                                onClick={() => handlePost(true)}
                                disabled={isSaving || isBroadcasting || !text}
                                className="flex-1 px-10 py-6 bg-rose-600 text-white border-8 border-stone-900 font-black uppercase tracking-widest text-sm shadow-[12px_12px_0px_0px_rgba(225,29,72,0.2)] hover:bg-rose-700 hover:shadow-none transition-all active:translate-y-2 disabled:opacity-30 group"
                            >
                                {isBroadcasting ? (
                                    <div className="flex items-center justify-center gap-3">
                                        <span className="w-4 h-4 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>ENVOI...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-3">
                                        <span>DIFFUSER MAINTENANT</span>
                                        <span className="text-xl group-hover:translate-x-2 group-hover:-translate-y-2 transition-transform">🚀</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-12 animate-in fade-in slide-in-from-right-6 duration-700">
                <div className="bg-stone-950 text-white rounded-[3rem] p-10 border-8 border-stone-900 shadow-2xl h-full flex flex-col relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-8 italic border-b-4 border-white/5 pb-6">Journal de bord</h3>
                    <div className="space-y-6 overflow-y-auto pr-4 custom-scrollbar flex-1">
                        {drafts.map((draft: any) => (
                            <div key={draft.id} className="group bg-stone-900 rounded-3xl border-4 border-white/5 p-6 hover:border-rose-500 transition-all cursor-default">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider ${draft.status === 'PUBLISHED' ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]'}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full bg-white ${draft.status === 'PUBLISHED' ? '' : 'animate-pulse'}`} />
                                        {draft.status}
                                    </div>
                                    <span className="text-[10px] font-black text-stone-600 uppercase">
                                        {new Date(draft.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-sm font-bold text-stone-400 group-hover:text-white transition-colors leading-relaxed line-clamp-5">{draft.text}</p>
                            </div>
                        ))}
                        {drafts.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-20 text-stone-800 opacity-50">
                                <span className="text-6xl mb-6">🏜️</span>
                                <p className="text-xs font-black uppercase tracking-[0.3em]">Vide Intergalactique</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}