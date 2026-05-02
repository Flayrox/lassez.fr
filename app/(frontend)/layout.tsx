import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Inter, Playfair_Display, JetBrains_Mono, Newsreader, Space_Grotesk } from 'next/font/google';
import { getNavItems } from '@/lib/db-nav';
import { getRadarConfig } from '@/lib/radar-config';
import ThemeInitializer from '@/components/ThemeInitializer';
import { getSettings } from '@/lib/get-settings';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import { SettingsProvider } from '@/components/SettingsProvider';
import { UIProvider } from '@/components/UIProvider';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });
const newsreader = Newsreader({ 
    subsets: ['latin'], 
    variable: '--font-newsreader',
    display: 'swap',
    style: ['normal', 'italic']
});
const spaceGrotesk = Space_Grotesk({ 
    subsets: ['latin'], 
    variable: '--font-space-grotesk',
    display: 'swap'
});

const DEFAULT_RADAR_CONFIG = {
    maintenance_mode: false,
    maintenance_message: '',
    popup_enabled: false,
    popup_title: '',
    popup_text: '',
    popup_link_url: '',
    popup_link_label: '',
};

const matomoBootstrapScript = (url: string, id: string) => `
  var _paq = window._paq = window._paq || [];
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function () {
    var u = "${url.endsWith('/') ? url : url + '/'}";
    _paq.push(['setTrackerUrl', u + 'matomo.php']);
    _paq.push(['setSiteId', '${id}']);
    var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
    g.async = true; g.src = u + 'matomo.js'; s.parentNode.insertBefore(g, s);
  })();
`;

const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: "L'Assez",
    url: 'https://lassez.fr',
    logo: 'https://lassez.fr/android-chrome-512x512.png',
    sameAs: [
        'https://twitter.com/lasse_media',
        'https://www.linkedin.com/company/lassez/',
    ],
    description: "Journalisme d'investigation indépendant en lutte pour la vérité.",
};

const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: "L'Assez",
    url: 'https://lassez.fr',
    potentialAction: {
        '@type': 'SearchAction',
        target: 'https://lassez.fr/search?q={search_term_string}',
        'query-input': 'required name=search_term_string',
    },
};



export const metadata: Metadata = {
    metadataBase: new URL('https://lassez.fr'),
    title: {
        default: "L'Assez | Journalisme d'investigation indépendant",
        template: "%s | L'Assez",
    },
    description: "L'Assez publie des enquêtes, des révélations et des analyses pour comprendre le monde sans filtre.",
    keywords: [
        "L'Assez",
        "l'Assez media",
        "journalisme d'investigation",
        "révélations",
        "enquêtes",
        "actualité politique",
        "analyse sociale",
    ],
    icons: {
        icon: '/logo_lassez_white.svg',
        apple: '/logo_lassez_white.svg',
    },
    alternates: {
        canonical: 'https://lassez.fr',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
        },
    },
    openGraph: {
        siteName: "L'Assez",
        locale: 'fr_FR',
        type: 'website',
        url: 'https://lassez.fr',
    },
    twitter: {
        card: 'summary_large_image',
        site: '@lasse_media',
    },
};

import { NavProvider } from '@/components/NavProvider';
import CommunicationLayer from '@/components/CommunicationLayer';
import { HeaderWrapper, SidebarWrapper, FooterWrapper } from '@/components/LayoutWrappers';

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const navItems = await getNavItems();
    const config = await getRadarConfig();
    const settings = await getSettings();

    const socialSameAs = [
        settings.socialLinks?.twitter,
        settings.socialLinks?.bluesky,
        settings.socialLinks?.mastodon,
        settings.socialLinks?.instagram,
        settings.socialLinks?.tiktok,
        settings.socialLinks?.telegram,
        settings.socialLinks?.linkedin,
    ].filter(Boolean) as string[];

    const orgLd = {
        ...organizationJsonLd,
        sameAs: socialSameAs.length > 0 ? socialSameAs : organizationJsonLd.sameAs,
    };

    const bodyClassName = 'public-plane bg-paper text-ink bg-noise overflow-x-hidden paper-texture';

    return (
        <html lang="fr" className={`${inter.variable} ${playfair.variable} ${jetbrains.variable} ${newsreader.variable} ${spaceGrotesk.variable}`}>
            <head>
                <meta name="fediverse:creator" content="@lassezmedia@mastodon.social" />
                <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
                <script
                    id="structured-data-org"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
                />
                <script
                    id="structured-data-website"
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
                />
            </head>
            <body className={bodyClassName}>
                <Script 
                    id="matomo-script" 
                    strategy="afterInteractive" 
                    dangerouslySetInnerHTML={{ 
                        __html: matomoBootstrapScript(
                            settings.matomoSettings?.matomoUrl || 'https://stats.lassez.fr/', 
                            settings.matomoSettings?.matomoId || '1'
                        ) 
                    }} 
                />

                <ThemeInitializer />


                <>
                    <SettingsProvider settings={settings}>
                        <CommunicationLayer config={config} />
                        <NavProvider initialNavItems={navItems as any}>
                            <UIProvider>
                                <div id="root" className="min-h-screen flex flex-col">
                                    <HeaderWrapper />
                                    {children}
                                    <FooterWrapper />
                                </div>
                            </UIProvider>
                        </NavProvider>
                    </SettingsProvider>
                </>

            </body>
        </html>
    );
}
