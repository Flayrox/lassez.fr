'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { HeartIcon } from './icons';

const JoinUsBlock: React.FC = () => {
    const router = useRouter();

    return (
        <div className="bg-lassez-gray p-6 rounded-lg text-center">
            <h2 className="text-xl md:text-2xl font-bold">Le journalisme indépendant a besoin de vous.</h2>
            <p className="mt-2 max-w-xl mx-auto text-xs md:text-sm text-gray-700">
                Nos enquêtes sont financées par des gens comme vous, pas par des milliardaires.
                Rejoignez-nous pour défendre une information libre et au service du public.
            </p>
            <button
                onClick={() => router.push('/soutenir')}
                className="mt-4 flex items-center justify-center space-x-2 bg-lassez-red text-white font-bold py-2 px-6 rounded-md hover:bg-red-700 transition-colors mx-auto text-sm"
            >
                <HeartIcon className="w-4 h-4" />
                <span>Je soutiens L'Assez</span>
            </button>
        </div>
    );
};

export default JoinUsBlock;