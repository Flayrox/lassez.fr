'use client';

import React, { useState } from 'react';
import { SendIcon, LoaderIcon, CheckCircleIcon } from './icons';

const TacticalNewsletter: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
    const [email, setEmail] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        setStatus('submitting');
        // The actual form submit happens via the iframe target in the background
        // We just simulate the success UI after a delay
        setTimeout(() => setStatus('success'), 2000);
    };

    return (
        <div className="w-full bg-ink text-paper p-1 border-2 border-lassez-red shadow-hard-sm overflow-hidden">
            <div className="border border-lassez-red/30 p-3 md:p-4 flex flex-col md:flex-row items-center gap-4 md:gap-8">
                {/* Status Indicator */}
                <div className="flex items-center gap-3 shrink-0">
                    <div className="relative flex items-center justify-center">
                        <span className={`absolute w-3 h-3 rounded-full animate-ping opacity-75 ${status === 'success' ? 'bg-green-500' : 'bg-lassez-red'}`}></span>
                        <span className={`relative w-1.5 h-1.5 rounded-full ${status === 'success' ? 'bg-green-500' : 'bg-lassez-red'}`}></span>
                    </div>
                    <span className="font-mono text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">
                        {status === 'success' ? 'Access_Permanent' : 'Radar_Alert_Protocol'}
                    </span>
                </div>

                {status === 'success' ? (
                    <div className="flex-grow flex items-center gap-3 animate-in fade-in slide-in-from-left duration-500">
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                        <span className="font-mono text-[10px] md:text-xs uppercase font-bold text-green-500 tracking-widest">Infiltration réussie. Bienvenue sur le réseau.</span>
                    </div>
                ) : (
                    <>
                        <div className="flex-grow">
                            <iframe name="newsletter_target" style={{ display: 'none' }}></iframe>
                            <form
                                action="https://849ebea0.sibforms.com/serve/MUIFAMaQCp68TfNhAzQcEkhku7hG_ns038ZoWuBSqAvyQTaQtIl7o9lu05dAXwomLXu1UQc5HcWE3dPqH3nIeDtKwL4G73-B8SKJ9ogvwTgE8JBUBs25pF63CEA412ooHwA6DmH3w-A8DJsfZ6Vtt4Pdme85_BhV8l8ZAv5Tpnh8cHeE379ae787z9XBeOyjU6mbTbV8lrTfGXn-6w=="
                                method="POST"
                                target="newsletter_target"
                                onSubmit={handleSubmit}
                                className="flex flex-col sm:flex-row items-stretch gap-2 w-full"
                            >
                                <input type="hidden" name="locale" value="fr" />
                                <input type="hidden" name="html_type" value="simple" />
                                
                                <div className="relative flex-grow min-w-0">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lassez-red font-mono text-xs font-black">{'>'}</span>
                                    <input
                                        type="email"
                                        name="EMAIL"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="IDENTIFIANT_EMAIL_REQUIS"
                                        className="w-full bg-transparent border-b border-paper/20 focus:border-lassez-red py-2 pl-7 pr-4 text-xs font-mono text-paper placeholder:text-paper/20 outline-none transition-all uppercase"
                                    />
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={status === 'submitting'}
                                    className="bg-lassez-red text-ink font-mono text-[10px] font-black px-6 py-2 uppercase hover:bg-paper transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                                >
                                    {status === 'submitting' ? (
                                        <LoaderIcon className="w-3 h-3" />
                                    ) : (
                                        <>
                                            <SendIcon className="w-3 h-3" />
                                            <span>Uplink_Start</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default TacticalNewsletter;
