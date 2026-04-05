
import React from 'react';
import { AlertTriangleIcon } from './icons';

interface KeyPointsProps {
    points: string[];
}

const KeyPoints: React.FC<KeyPointsProps> = ({ points }) => {
    if (!points || points.length === 0) return null;

    return (
        <div className="bg-marker-yellow border-2 border-black p-6 shadow-hard transform -rotate-1 my-6 max-w-2xl mx-auto relative z-10">
            <h3 className="text-lg md:text-xl font-black font-sans uppercase flex items-center mb-4 border-b-2 border-black pb-2">
                <AlertTriangleIcon className="w-5 h-5 md:w-6 md:h-6 mr-3 text-black" />
                Faits Avérés
            </h3>
            <ul className="space-y-3 font-mono text-[11px] md:text-sm">
                {points.map((point, index) => (
                    <li key={index} className="flex items-start">
                        <span className="mr-3 font-bold">[{index + 1}]</span>
                        <span className="font-medium">{point}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default KeyPoints;
