import { MetadataRoute } from 'next';
import { getSettings } from '@/lib/get-settings';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
    const settings = await getSettings();
    const manifest = settings.manifest;

    return {
        name: manifest?.siteName || "L'Assez | Journalisme d'investigation",
        short_name: manifest?.shortName || "L'Assez",
        description: manifest?.description || "Média indépendant d'investigation et de révélations.",
        start_url: '/',
        display: 'standalone',
        background_color: manifest?.backgroundColor || '#FBF9F4',
        theme_color: manifest?.themeColor || '#B91C1C',
        icons: [
            {
                src: '/android-chrome-192x192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/android-chrome-512x512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/favicon-32x32.png',
                sizes: '32x32',
                type: 'image/png',
            },
            {
                src: '/favicon-16x16.png',
                sizes: '16x16',
                type: 'image/png',
            },
        ],
    };
}
