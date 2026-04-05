import React from 'react';
import { FileTextIcon, ShareIcon } from './icons';

interface CallToActionBlockProps {
    onShare: () => void;
}

const CallToActionBlock: React.FC<CallToActionBlockProps> = ({ onShare }) => {
    return (
        <div className="bg-black text-white p-8 border-4 border-black shadow-hard mt-16 text-center">
            <h3 className="text-4xl font-black uppercase italic tracking-tighter mb-4">Ne restez pas spectateur.</h3>
            <p className="font-mono text-sm max-w-xl mx-auto mb-8 border-l-2 border-lassez-red pl-4 text-left">
                L'information n'a de valeur que si elle mène à l'action. Signez, partagez, organisez-vous.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a href="https://www.change.org" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center space-x-2 bg-lassez-red text-white font-bold py-4 px-8 border-2 border-transparent hover:bg-white hover:text-lassez-red hover:border-lassez-red transition-all uppercase tracking-wider">
                    <FileTextIcon className="w-5 h-5" />
                    <span>Signer la pétition</span>
                </a>
                <button onClick={onShare} className="flex items-center justify-center space-x-2 bg-transparent border-2 border-white text-white font-bold py-4 px-8 hover:bg-white hover:text-black transition-all uppercase tracking-wider">
                    <ShareIcon className="w-5 h-5" />
                    <span>Diffuser l'enquête</span>
                </button>
            </div>
        </div>
    );
};

export default CallToActionBlock;