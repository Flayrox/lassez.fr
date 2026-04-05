'use client';

import React from 'react';
import { MicIcon, Volume2Icon } from './icons';

const podcasts = [
    { id: 'tape_01', title: 'INFILTRATION : LE RÉSEAU', date: '24.10.2023', duration: '42:10', src: 'https://open.spotify.com/embed/episode/7makk4oTQel546B0PZlDM5' },
    { id: 'tape_02', title: 'L\'ARGENT DE LA PEUR', date: '12.10.2023', duration: '35:05', src: 'https://open.spotify.com/embed/episode/6uLfA02tA14roisG5wLAZG' },
    { id: 'tape_03', title: 'CONFESSIONS D\'UN LOBBYISTE', date: '05.09.2023', duration: '58:22', src: 'https://open.spotify.com/embed/episode/2Y8g35g5d5j3oZ0Y2Z2M3D' },
    { id: 'tape_04', title: 'ARCHIVE PERDUE #99', date: 'UNKNOWN', duration: '12:00', src: 'https://open.spotify.com/embed/episode/4J4z4z4z4z4z4z4z4z4z4z' }
];

const PodcastPlayer: React.FC<{ tape: typeof podcasts[0] }> = ({ tape }) => {
    const handleReadAloud = () => {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(`Lecture de la cassette ${tape.title}. Durée estimée ${tape.duration}.`);
            speechSynthesis.speak(utterance);
        } else {
            alert("Terminal audio non compatible.");
        }
    };

    return (
        <div className="bg-neutral-900 p-4 border-4 border-gray-600 rounded-sm shadow-hard relative group">
            <div className="absolute top-2 left-2 w-3 h-3 rounded-full bg-gray-700 flex items-center justify-center"><div className="w-3 h-0.5 bg-gray-900 rotate-45"></div></div>
            <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-gray-700 flex items-center justify-center"><div className="w-3 h-0.5 bg-gray-900 rotate-45"></div></div>
            <div className="absolute bottom-2 left-2 w-3 h-3 rounded-full bg-gray-700 flex items-center justify-center"><div className="w-3 h-0.5 bg-gray-900 rotate-45"></div></div>
            <div className="absolute bottom-2 right-2 w-3 h-3 rounded-full bg-gray-700 flex items-center justify-center"><div className="w-3 h-0.5 bg-gray-900 rotate-45"></div></div>

            <div className="bg-white px-4 py-2 mb-4 border border-gray-400 transform rotate-0.5 shadow-sm">
                <div className="font-mono text-xs text-gray-500 uppercase flex justify-between">
                    <span>EVIDENCE: {tape.id}</span>
                    <span>DATE: {tape.date}</span>
                </div>
                <h3 className="font-black font-sans uppercase text-lg leading-tight text-black truncate">{tape.title}</h3>
            </div>

            <div className="bg-gray-800 border-2 border-gray-600 p-2 rounded mb-3 relative overflow-hidden">
                <div className="absolute inset-0 flex justify-between px-8 items-center opacity-20 pointer-events-none">
                    <div className="w-12 h-12 border-4 border-white rounded-full border-dashed animate-[spin_4s_linear_infinite]"></div>
                    <div className="w-12 h-12 border-4 border-white rounded-full border-dashed animate-[spin_4s_linear_infinite_reverse]"></div>
                </div>

                <iframe
                    style={{ borderRadius: '4px', position: 'relative', zIndex: 10 }}
                    src={tape.src}
                    width="100%"
                    height="80"
                    frameBorder="0"
                    allowFullScreen={false}
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                ></iframe>
            </div>

            <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_5px_red]"></div>
                    <span className="font-mono text-red-600 text-xs font-bold uppercase tracking-widest">REC</span>
                </div>
                <button onClick={handleReadAloud} className="text-xs font-mono text-gray-400 hover:text-white border border-gray-600 px-2 py-1 uppercase hover:border-white transition-colors flex items-center gap-2">
                    <Volume2Icon className="w-3 h-3" /> Transcription
                </button>
            </div>
        </div>
    );
};

const PodcastsClient: React.FC = () => {
    return (
        <div className="min-h-screen pb-12">
            <header className="mb-12 border-b-4 border-black pb-8">
                <div className="inline-block bg-black text-white px-2 py-1 mb-2 font-mono text-xs uppercase tracking-widest">
                    Centre d'Écoutes
                </div>
                <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter">
                    Interceptions <span className="text-lassez-red">Audio</span>
                </h1>
                <p className="text-xl font-serif italic mt-4 max-w-2xl">
                    Les enregistrements qu'ils pensaient avoir supprimés. Écoutez ce qui se dit derrière les portes closes.
                </p>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8 px-4">
                {podcasts.map((tape, index) => (
                    <div key={index} className={index % 2 !== 0 ? 'md:mt-12' : ''}>
                        <PodcastPlayer tape={tape} />
                    </div>
                ))}
            </div>

            <div className="mt-16 border-t-2 border-dashed border-gray-400 pt-8 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-black rounded-full mb-4">
                    <MicIcon className="w-8 h-8" />
                </div>
                <p className="font-mono text-sm uppercase">Vous avez des enregistrements ?</p>
                <a href="mailto:leak@lassez.org" className="font-black hover:bg-lassez-red hover:text-white px-2 transition-colors">Envoyer via SecureDrop</a>
            </div>
        </div>
    );
};

export default PodcastsClient;
