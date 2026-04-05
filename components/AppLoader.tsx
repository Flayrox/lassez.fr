import React, { useEffect, useState } from 'react';

const AppLoader: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
    const [progress, setProgress] = useState(0);
    const [text, setText] = useState('INITIALISATION');

    useEffect(() => {
        // Sequence of loading texts
        const texts = [
            'CONNEXION SATELLITE...',
            'DÉCHIFFREMENT DES DONNÉES...',
            'ACCÈS AUX ARCHIVES...',
            'SYSTEM_READY'
        ];

        let textIndex = 0;

        // Text rotation interval
        const textInterval = setInterval(() => {
            textIndex = (textIndex + 1) % texts.length;
            setText(texts[textIndex]);
        }, 450);

        // Progress bar interval
        const progressInterval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(progressInterval);
                    clearInterval(textInterval);
                    setTimeout(onComplete, 200); // Small delay before unmounting
                    return 100;
                }
                // Random increment for "hacking" feel
                return Math.min(prev + Math.random() * 8, 100);
            });
        }, 100);

        return () => {
            clearInterval(progressInterval);
            clearInterval(textInterval);
        };
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[9999] bg-black text-paper flex flex-col items-center justify-center font-mono">
            <div className="w-64 space-y-4">
                <div className="flex justify-between text-xs uppercase tracking-widest text-lassez-red">
                    <span>Chargement</span>
                    <span>{Math.floor(progress)}%</span>
                </div>

                {/* Progress Bar */}
                <div className="h-1 w-full bg-gray-900 overflow-hidden">
                    <div
                        className="h-full bg-lassez-red transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(255,0,0,0.8)]"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>

                {/* Text */}
                <div className="text-center text-sm font-bold uppercase animate-pulse">
                    {text}
                </div>
            </div>
        </div>
    );
};

export default AppLoader;
