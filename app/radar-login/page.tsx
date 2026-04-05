'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function RadarLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/radar/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            const data = await res.json();

            if (res.ok && data.success) {
                router.push('/radar-admin');
            } else {
                setError(data.error || 'Accès refusé. Intrusion détectée.');
            }
        } catch (err: any) {
            setError("Erreur de connexion au serveur.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-neutral-200 flex items-center justify-center font-mono relative overflow-hidden">
            {/* Grille de fond subtile */}
            <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 w-full max-w-md p-8 bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl flex flex-col items-center"
            >
                <div className="w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6 text-2xl border border-red-900/50 shadow-[0_0_15px_rgba(220,38,38,0.3)] animate-pulse">
                    🔒
                </div>

                <h1 className="text-2xl font-bold uppercase tracking-widest text-neutral-300 mb-2 text-center">
                    RADAR L'ASSEZ
                </h1>
                <p className="text-xs text-neutral-500 mb-8 uppercase tracking-widest text-center">
                    Accès strictement restreint.
                </p>

                <form onSubmit={handleLogin} className="w-full space-y-5">
                    <AnimatePresence>
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                className="bg-red-900/30 border border-red-800 text-red-400 text-xs p-3 rounded text-center tracking-wider"
                            >
                                ⚠️ {error}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div>
                        <label className="block text-xs uppercase text-neutral-600 mb-2 tracking-widest font-bold">Identifiant</label>
                        <input
                            type="text"
                            name="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            autoComplete="username"
                            className="w-full bg-black border border-neutral-800 rounded px-4 py-3 text-sm focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors"
                            placeholder="admin"
                        />
                    </div>
                    <div>
                        <label className="block text-xs uppercase text-neutral-600 mb-2 tracking-widest font-bold">Mot de passe</label>
                        <input
                            type="password"
                            name="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            autoComplete="current-password"
                            className="w-full bg-black border border-neutral-800 rounded px-4 py-3 text-sm focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-colors placeholder:text-neutral-700"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 bg-red-800 hover:bg-red-700 text-white font-bold text-sm uppercase tracking-[0.2em] py-4 rounded transition-all duration-300 relative overflow-hidden group disabled:opacity-50"
                    >
                        <span className="relative z-10">{loading ? 'Vérification...' : 'Déverrouiller'}</span>
                        <div className="absolute inset-0 bg-red-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-0"></div>
                    </button>
                </form>

                <div className="mt-8 text-[10px] text-neutral-600 text-center uppercase tracking-widest opacity-50">
                    Toute tentative d'intrusion sera loggée.
                </div>
            </motion.div>
        </div>
    );
}
