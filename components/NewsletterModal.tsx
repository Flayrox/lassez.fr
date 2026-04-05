import React, { useState, useEffect } from 'react';
import { XIcon, CheckCircleIcon, LockIcon } from './icons';

interface NewsletterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const NewsletterModal: React.FC<NewsletterModalProps> = ({ isOpen, onClose }) => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'ready'>('idle');
    const [logs, setLogs] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && status === 'idle') {
            setLogs([]);
            // Simulate terminal logs
            const initialLogs = [
                'Initialisation du protocole...',
                'Recherche de canal sécurisé...',
                'Handshake Brevo Secure Uplink...',
                'Connexion établie.'
            ];
            let i = 0;
            const interval = setInterval(() => {
                if (i < initialLogs.length) {
                    setLogs(prev => [...prev, initialLogs[i]]);
                    i++;
                } else {
                    clearInterval(interval);
                    setStatus('ready');
                }
            }, 400);
            return () => clearInterval(interval);
        }
    }, [isOpen, status]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-md bg-black border-4 border-lassez-border shadow-[0_0_50px_rgba(255,0,0,0.2)] p-1 text-green-500 font-mono">
                {/* Header */}
                <div className="flex justify-between items-center bg-gray-900 px-3 py-2 border-b border-gray-800 mb-2">
                    <div className="flex items-center gap-2">
                        <LockIcon className="w-3 h-3 text-lassez-red animate-pulse" />
                        <span className="text-xs uppercase tracking-widest text-gray-400">Canal_Sécurisé_#99</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <XIcon className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 md:p-6">
                    <h2 className="text-2xl font-black text-white uppercase mb-1 glitch-text" data-text="FUITES_&_RÉVÉLATIONS">
                        FUITES_&_RÉVÉLATIONS
                    </h2>
                    <p className="text-xs text-gray-500 mb-6 uppercase tracking-widest">
                        Rejoignez le réseau. Recevez ce qu'ils veulent cacher.
                    </p>

                    {/* Logs Display */}
                    <div className="bg-gray-900/50 p-3 mb-6 h-24 overflow-y-auto text-[10px] space-y-1 font-mono border border-gray-800">
                        {logs.map((log, i) => (
                            <div key={i} className="opacity-80">
                                <span className="text-lassez-red mr-2">{'>'}</span>
                                {log}
                            </div>
                        ))}
                        <div className="animate-pulse">_</div>
                    </div>

                    {status === 'connecting' ? (
                        <div className="py-8 text-center space-y-4">
                            <div className="text-lassez-red font-black uppercase text-xl animate-pulse">
                                Établissement du tunnel sécurisé...
                            </div>
                            <div className="h-2 w-48 mx-auto bg-gray-800 rounded-full overflow-hidden border border-gray-600">
                                <div className="h-full bg-lassez-red animate-[width_1s_ease-in-out_infinite]"></div>
                            </div>
                        </div>
                    ) : status === 'success' ? (
                        <div className="flex flex-col items-center text-center py-4 animate-in fade-in zoom-in duration-300">
                            <CheckCircleIcon className="w-12 h-12 text-lassez-red mb-4" />
                            <h3 className="text-xl font-bold text-white uppercase mb-2">Infiltration Réussie</h3>
                            <p className="text-sm opacity-70">Vous êtes maintenant sur la liste.</p>
                            <button
                                onClick={onClose}
                                className="mt-6 text-xs uppercase underline hover:text-white"
                            >
                                Fermer le terminal
                            </button>
                        </div>
                    ) : (
                        <>
                            <iframe name="hidden_iframe" style={{ display: 'none' }} title="hidden_iframe"></iframe>
                            <form
                                action="https://849ebea0.sibforms.com/serve/MUIFAMaQCp68TfNhAzQcEkhku7hG_ns038ZoWuBSqAvyQTaQtIl7o9lu05dAXwomLXu1UQc5HcWE3dPqH3nIeDtKwL4G73-B8SKJ9ogvwTgE8JBUBs25pF63CEA412ooHwA6DmH3w-A8DJsfZ6Vtt4Pdme85_BhV8l8ZAv5Tpnh8cHeE379ae787z9XBeOyjU6mbTbV8lrTfGXn-6w=="
                                method="POST"
                                target="hidden_iframe"
                                onSubmit={() => {
                                    setStatus('connecting');
                                    // Give it a bit more time for the real post to happen in background
                                    setTimeout(() => setStatus('success'), 3000);
                                }}
                                className="space-y-4"
                            >
                                <input type="hidden" name="locale" value="fr" />
                                <input type="hidden" name="html_type" value="simple" />
                                <input type="text" name="email_address_check" value="" className="hidden" readOnly />

                                <div className="relative">
                                    <input
                                        type="email"
                                        id="EMAIL"
                                        name="EMAIL"
                                        autoComplete="off"
                                        required
                                        className="w-full bg-gray-900 border-2 border-gray-700 text-white px-4 py-3 text-sm focus:outline-none focus:border-lassez-red focus:shadow-[0_0_10px_rgba(255,0,0,0.5)] transition-all placeholder:text-gray-700 font-mono"
                                        placeholder="ENTREZ_VOTRE_EMAIL"
                                    />
                                </div>

                                <label className="flex items-start gap-2 text-[10px] text-gray-500 cursor-pointer hover:text-gray-300 transition-colors bg-gray-900/50 p-2 border border-gray-800">
                                    <input type="checkbox" required className="mt-0.5 accent-lassez-red" />
                                    <span>J'accepte de recevoir les communications cryptées de L'Assez. (RGPD)</span>
                                </label>

                                <button
                                    type="submit"
                                    className="w-full bg-lassez-red text-black font-black uppercase text-sm py-3 hover:bg-white hover:text-black transition-colors shadow-[0_0_15px_rgba(255,0,0,0.3)] hover:shadow-[0_0_25px_rgba(255,0,0,0.6)]"
                                >
                                    INITIALISER L'UPLINK
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewsletterModal;
