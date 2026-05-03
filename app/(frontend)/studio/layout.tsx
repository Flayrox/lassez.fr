import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Studio — L\'Assez',
    description: 'Création de contenus visuels pour Instagram par IA et outils manuels',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="w-screen h-screen overflow-hidden">
            {children}
        </div>
    );
}
