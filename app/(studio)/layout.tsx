import type { Metadata } from 'next';
import '@/app/(frontend)/globals.css';
import { Inter, Space_Grotesk } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
    title: 'Templates IG — L\'Assez',
    description: 'Création de contenus visuels (Templates) pour Instagram',
};

export default function StudioLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="fr" className={`${inter.variable} ${spaceGrotesk.variable}`}>
            <body className="w-screen h-screen overflow-hidden bg-background text-foreground m-0 p-0">
                {children}
            </body>
        </html>
    );
}