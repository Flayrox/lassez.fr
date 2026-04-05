'use client';

import React, { useState, useEffect } from 'react';
import { HeartIcon, CheckCircleIcon, ShareIcon, LockIcon } from './icons';

const ENABLE_FINANCIAL_SUPPORT = false;

const FloatingHearts: React.FC = () => {
    const [hearts, setHearts] = useState<{ id: number; left: number; delay: number; duration: number; sway: number }[]>([]);

    useEffect(() => {
        const newHearts = Array.from({ length: 30 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            delay: Math.random() * 5,
            duration: 4 + Math.random() * 6,
            sway: (Math.random() - 0.5) * 50
        }));
        setHearts(newHearts);
    }, []);

    return (
        <div className="absolute inset-x-0 top-[260px] bottom-0 overflow-hidden pointer-events-none z-0">
            {hearts.map(heart => (
                <div
                    key={heart.id}
                    className="absolute text-lassez-red opacity-0 animate-fall-sway"
                    style={{
                        left: `${heart.left}%`,
                        animationDelay: `${heart.delay}s`,
                        animationDuration: `${heart.duration}s`,
                        fontSize: `${Math.random() * 10 + 8}px`,
                        '--sway-amount': `${heart.sway}px`
                    } as React.CSSProperties}
                >
                    <HeartIcon className="w-full h-full fill-current" />
                </div>
            ))}
            <style>{`
                @keyframes fall-sway {
                    0% { transform: translate(0, 0) rotate(0deg); opacity: 0; }
                    10% { opacity: 0.6; }
                    50% { transform: translate(var(--sway-amount), 50vh) rotate(180deg); opacity: 0.4; }
                    100% { transform: translate(0, 100vh) rotate(360deg); opacity: 0; }
                }
                .animate-fall-sway { animation-name: fall-sway; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
            `}</style>
        </div>
    );
};

const SoutenirClient: React.FC = () => {
    const [signedUp, setSignedUp] = useState(false);
    const [status, setStatus] = useState<'idle' | 'connecting' | 'success'>('idle');

    const [donationType, setDonationType] = useState<'monthly' | 'once'>('monthly');
    const [petitionSigned, setPetitionSigned] = useState(false);
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');

    const handlePetitionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formName && formEmail.includes('@')) setPetitionSigned(true);
    };

    return (
        <div className="max-w-5xl mx-auto pb-20 space-y-24 min-h-screen relative overflow-hidden">
            <FloatingHearts />

            <section className="relative text-center py-20 border-y-4 border-black bg-marker-yellow -mx-4 rotate-1 shadow-hard-xl mt-12 z-10">
                <div className="absolute top-0 left-0 w-full h-full bg-noise opacity-50 pointer-events-none"></div>

                {ENABLE_FINANCIAL_SUPPORT ? (
                    <>
                        <h1 className="text-6xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85] mb-6 transform -skew-x-6">
                            FINANCEZ <br /><span className="text-white text-stroke-black">LA RÉSISTANCE</span>
                        </h1>
                        <p className="font-mono font-bold text-xl uppercase tracking-widest max-w-2xl mx-auto bg-black text-white p-2 transform rotate-1">
                            L'information est une arme. Donnez-nous les munitions.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="text-5xl md:text-8xl font-black uppercase tracking-tighter leading-[0.85] mb-6 transform -skew-x-6 text-ink">
                            REJOIGNEZ <br /><span className="text-paper text-stroke-black">LA RÉSISTANCE</span>
                        </h1>
                        <p className="font-mono font-bold text-lg md:text-xl uppercase tracking-widest max-w-2xl mx-auto bg-black text-white p-2 transform rotate-1">
                            L'information est une arme. Aidez-nous à la diffuser.
                        </p>
                    </>
                )}
            </section>

            {ENABLE_FINANCIAL_SUPPORT ? (
                <section className="grid md:grid-cols-2 gap-12 px-4 relative z-10">
                    <div className="border-4 border-black bg-white p-8 shadow-hard flex flex-col relative group">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-lassez-red text-white px-4 py-1 font-black uppercase tracking-widest border-2 border-black shadow-hard-sm">Le plus efficace</div>
                        <h2 className="text-3xl font-black uppercase mb-6 text-center border-b-4 border-black pb-4">Abonnement Militant</h2>
                        <div className="flex justify-center space-x-4 mb-8">
                            <button onClick={() => setDonationType('monthly')} className={`px-6 py-3 font-bold font-mono border-2 border-black uppercase transition-all ${donationType === 'monthly' ? 'bg-black text-white shadow-hard-sm' : 'bg-white text-black hover:bg-gray-100'}`}>Mensuel</button>
                            <button onClick={() => setDonationType('once')} className={`px-6 py-3 font-bold font-mono border-2 border-black uppercase transition-all ${donationType === 'once' ? 'bg-black text-white shadow-hard-sm' : 'bg-white text-black hover:bg-gray-100'}`}>Ponctuel</button>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {['5€', '10€', '20€'].map((amount) => (
                                <button key={amount} className="border-2 border-black py-4 font-black text-2xl hover:bg-lassez-red hover:text-white transition-colors focus:bg-black focus:text-white shadow-hard-sm">{amount}</button>
                            ))}
                        </div>
                        <button className="mt-auto w-full bg-lassez-red text-white font-black text-xl py-6 border-2 border-black shadow-hard hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all uppercase tracking-wider flex items-center justify-center gap-3">
                            <HeartIcon className="w-6 h-6" /> Soutenir L'Indépendance
                        </button>
                        <p className="text-xs text-center mt-4 font-mono text-gray-500">Défiscalisable à 66%. Reçu fiscal envoyé annuellement.</p>
                    </div>
                    <div className="bg-black text-white p-8 border-4 border-white outline outline-4 outline-black shadow-hard transform -rotate-1">
                        <h2 className="text-3xl font-black uppercase mb-2 text-lassez-red">Pétition en cours</h2>
                        <h3 className="text-xl font-bold uppercase mb-6 border-b border-gray-600 pb-4">Pour la transparence totale des élus</h3>
                        {!petitionSigned ? (
                            <form onSubmit={handlePetitionSubmit} className="space-y-4">
                                <div><label className="block font-mono text-xs uppercase mb-1 text-gray-400">Nom de code</label><input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-600 p-3 focus:border-white focus:outline-none text-white font-mono" placeholder="CITOYEN.NE X" /></div>
                                <div><label className="block font-mono text-xs uppercase mb-1 text-gray-400">Contact</label><input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className="w-full bg-gray-900 border-2 border-gray-600 p-3 focus:border-white focus:outline-none text-white font-mono" placeholder="EMAIL@EXEMPLE.COM" /></div>
                                <button type="submit" className="w-full bg-white text-black font-black py-4 border-2 border-transparent hover:bg-lassez-red hover:text-white hover:border-white transition-colors uppercase tracking-widest mt-4">Signer l'appel</button>
                            </form>
                        ) : (
                            <div className="h-64 flex flex-col items-center justify-center border-2 border-green-500 bg-green-900/20 p-6 text-center animate-pulse"><CheckCircleIcon className="w-16 h-16 text-green-500 mb-4" /><p className="font-black text-2xl uppercase text-green-500">Signature Enregistrée</p></div>
                        )}
                    </div>
                </section>
            ) : (
                <section className="grid md:grid-cols-2 gap-12 px-4 relative z-10">
                    <div className="bg-black text-white p-8 border-4 border-white outline outline-4 outline-black shadow-hard transform -rotate-1 flex flex-col justify-center relative overflow-hidden group">
                        <div className="absolute -right-12 -top-12 opacity-10 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                            <LockIcon className="w-64 h-64" />
                        </div>
                        <div className="flex items-center gap-2 text-lassez-red mb-4 animate-pulse relative z-10">
                            <LockIcon className="w-5 h-5" />
                            <span className="font-mono text-xs uppercase tracking-widest">Canal Sécurisé</span>
                        </div>
                        <h2 className="text-3xl font-black uppercase mb-4 text-white relative z-10">
                            La Newsletter <span className="text-lassez-red">Confidentielle</span>
                        </h2>
                        <p className="font-serif text-gray-400 mb-8 relative z-10">
                            Ne ratez aucune révélation. Recevez nos enquêtes directement dans votre boîte mail, sans algorithme pour nous censurer.
                        </p>

                        {!signedUp ? (
                            <div className="relative z-10">
                                <iframe name="hidden_iframe_soutenir" style={{ display: 'none' }} title="hidden_iframe_soutenir"></iframe>
                                <form
                                    action="https://849ebea0.sibforms.com/serve/MUIFAMaQCp68TfNhAzQcEkhku7hG_ns038ZoWuBSqAvyQTaQtIl7o9lu05dAXwomLXu1UQc5HcWE3dPqH3nIeDtKwL4G73-B8SKJ9ogvwTgE8JBUBs25pF63CEA412ooHwA6DmH3w-A8DJsfZ6Vtt4Pdme85_BhV8l8ZAv5Tpnh8cHeE379ae787z9XBeOyjU6mbTbV8lrTfGXn-6w=="
                                    method="POST"
                                    target="hidden_iframe_soutenir"
                                    onSubmit={() => { setStatus('connecting'); setTimeout(() => { setStatus('success'); setSignedUp(true); }, 2000); }}
                                    className="space-y-4"
                                >
                                    <input type="hidden" name="locale" value="fr" />
                                    <input type="hidden" name="html_type" value="simple" />
                                    <input type="text" name="email_address_check" value="" className="hidden" readOnly />
                                    <div className="relative">
                                        <input type="email" id="EMAIL" name="EMAIL" autoComplete="off" required className="w-full bg-gray-900 border-2 border-gray-700 text-white px-4 py-4 text-base focus:outline-none focus:border-lassez-red focus:shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-all placeholder:text-gray-600 font-mono uppercase" placeholder="VOTRE_EMAIL_SECURISE" />
                                    </div>
                                    <label className="flex items-start gap-3 text-[10px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors bg-gray-900/50 p-3 border border-gray-800">
                                        <input type="checkbox" required className="mt-0.5 accent-lassez-red w-4 h-4" />
                                        <span>J'accepte de recevoir les communications de L'Assez.</span>
                                    </label>
                                    <button type="submit" disabled={status === 'connecting'} className="w-full bg-lassez-red text-white font-black uppercase text-lg py-4 border-2 border-transparent hover:bg-white hover:text-black transition-all shadow-hard active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-wait">
                                        {status === 'connecting' ? 'Chiffrement en cours...' : "S'INSCRIRE AU RÉSEAU"}
                                    </button>
                                </form>
                            </div>
                        ) : (
                            <div className="h-48 flex flex-col items-center justify-center border-2 border-green-500 bg-green-900/20 p-6 text-center animate-in zoom-in duration-300 relative z-10">
                                <CheckCircleIcon className="w-16 h-16 text-green-500 mb-4" />
                                <p className="font-black text-2xl uppercase text-green-500">Bienvenue</p>
                                <p className="font-mono text-sm mt-2 text-gray-400">Surveillez vos courriers indésirables.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col gap-6">
                        <a href="https://twitter.com/Lassez_Info" target="_blank" rel="noopener noreferrer" className="group bg-paper-bright border-4 border-black p-6 shadow-hard hover:shadow-hard-xl hover:-translate-y-1 transition-all flex items-center justify-between">
                            <div><h3 className="font-black text-xl uppercase mb-1">X (Twitter)</h3><p className="font-serif text-sm text-gray-600">L'info en temps réel.</p></div>
                            <div className="bg-black text-white p-3 rounded-full group-hover:bg-lassez-red transition-colors"><svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zl-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg></div>
                        </a>
                        <a href="https://bsky.app/profile/lassez.info" target="_blank" rel="noopener noreferrer" className="group bg-paper-bright border-4 border-black p-6 shadow-hard hover:shadow-hard-xl hover:-translate-y-1 transition-all flex items-center justify-between">
                            <div><h3 className="font-black text-xl uppercase mb-1">Bluesky</h3><p className="font-serif text-sm text-gray-600">Le refuge sans algo.</p></div>
                            <div className="bg-blue-500 text-white p-3 rounded-full group-hover:bg-blue-600 transition-colors"><div className="w-5 h-5 bg-current rounded-sm"></div></div>
                        </a>
                        <a href="https://instagram.com/lassez.info" target="_blank" rel="noopener noreferrer" className="group bg-paper-bright border-4 border-black p-6 shadow-hard hover:shadow-hard-xl hover:-translate-y-1 transition-all flex items-center justify-between">
                            <div><h3 className="font-black text-xl uppercase mb-1">Instagram</h3><p className="font-serif text-sm text-gray-600">Les coulisses de l'enquête.</p></div>
                            <div className="bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 text-white p-3 rounded-full group-hover:opacity-90 transition-opacity"><svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg></div>
                        </a>
                        <div className="bg-marker-yellow border-4 border-black p-6 shadow-hard mt-auto relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-white opacity-20 animate-pulse"></div>
                            <h3 className="font-black text-xl uppercase mb-2 flex items-center gap-2"><ShareIcon className="w-5 h-5" /> Partagez</h3>
                            <p className="font-mono font-bold text-xs">Notre seule visibilité, c'est VOUS.</p>
                        </div>
                    </div>
                </section>
            )}

            <section className="max-w-3xl mx-auto px-4 text-center relative z-10">
                <h2 className="text-4xl font-black uppercase mb-8 italic">Pourquoi nous soutenir ?</h2>
                <div className="grid md:grid-cols-3 gap-6 font-mono text-sm text-left">
                    <div className="border-l-4 border-black pl-4"><strong className="block text-lg mb-2 uppercase">0% Publicité</strong>Nous ne vendons pas votre temps de cerveau disponible.</div>
                    <div className="border-l-4 border-black pl-4"><strong className="block text-lg mb-2 uppercase">0% Actionnaires</strong>Pas de milliardaire pour nous censurer.</div>
                    <div className="border-l-4 border-black pl-4"><strong className="block text-lg mb-2 uppercase">100% Impact</strong>{ENABLE_FINANCIAL_SUPPORT ? "Chaque euro finance une heure d'enquête." : "Chaque partage compte plus qu'un don."}</div>
                </div>
            </section>
        </div>
    );
};

export default SoutenirClient;
