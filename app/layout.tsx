import type { Metadata } from 'next';
import Script from 'next/script';
import { headers } from 'next/headers';
import './globals.css';
import { Inter, Playfair_Display, JetBrains_Mono, Newsreader, Space_Grotesk } from 'next/font/google';
import { getNavItems } from '@/lib/db-nav';
import { getRadarConfig } from '@/lib/radar-config';
import { NavProvider } from '@/components/NavProvider';
import CommunicationLayer from '@/components/CommunicationLayer';

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

function isControlPlaneRequest(hostname: string, pathname: string) {
    return (
        hostname.startsWith('api.') ||
        pathname === '/admin' ||
        pathname.startsWith('/admin/') ||
        pathname.startsWith('/api/payload') ||
        pathname.startsWith('/api/payload-graphql') ||
        pathname.startsWith('/api/payload-graphql-playground')
    );
}

export const metadata: Metadata = {
    metadataBase: new URL('https://lassez.fr'),
    title: "L'Assez - L'avenir est antifasciste",
    description: "Journalisme d'investigation indépendant. Enquêtes, révélations et analyses pour comprendre le monde sans filtre.",
    icons: {
        icon: '/logo_lassez_white.svg',
        apple: '/logo_lassez_white.svg',
    },
    openGraph: {
        siteName: "L'Assez",
        locale: 'fr_FR',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        site: '@lasse_media',
    },
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const requestHeaders = await headers();
    const hostname = String(requestHeaders.get('x-request-host') || requestHeaders.get('host') || '').toLowerCase();
    const pathname = String(requestHeaders.get('x-request-path') || '/');
    const controlPlaneRequest = isControlPlaneRequest(hostname, pathname);

    const [navItems, config] = controlPlaneRequest
        ? [[], DEFAULT_RADAR_CONFIG]
        : [await getNavItems(), await getRadarConfig()];

    const bodyClassName = controlPlaneRequest
        ? 'min-h-screen bg-white text-black'
        : 'bg-paper text-ink bg-noise overflow-x-hidden paper-texture';

    return (
        <html lang="fr" className={`${inter.variable} ${playfair.variable} ${jetbrains.variable} ${newsreader.variable} ${spaceGrotesk.variable}`}>

            <head>
                {!controlPlaneRequest && <meta name="fediverse:creator" content="@lassezmedia@mastodon.social" />}
                {!controlPlaneRequest && <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />}
                {!controlPlaneRequest && (
                    <Script id="matomo-script" strategy="afterInteractive">
                        {`
            var _paq = window._paq = window._paq || [];
            /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
            _paq.push(['trackPageView']);
            _paq.push(['enableLinkTracking']);
            (function () {
              var u = "//stats.lassez.fr/";
              _paq.push(['setTrackerUrl', u + 'matomo.php']);
              _paq.push(['setSiteId', '1']);
              var d = document, g = d.createElement('script'), s = d.getElementsByTagName('script')[0];
              g.async = true; g.src = u + 'matomo.js'; s.parentNode.insertBefore(g, s);
            })();
          `}
                    </Script>
                )}
            </head>
            <body className={bodyClassName}>
                {!controlPlaneRequest && (
                    <Script id="theme-script" strategy="beforeInteractive">
                        {`
            if (localStorage.getItem('theme') === 'red') {
              document.body.classList.add('theme-red');
            }
          `}
                    </Script>
                )}

                {!controlPlaneRequest && (
                    <>
                        {/* Structured Data: Organization & WebSite */}
                        <Script id="structured-data-org" type="application/ld+json" strategy="beforeInteractive">
                            {JSON.stringify({
                                "@context": "https://schema.org",
                                "@type": "Organization",
                                "name": "L'Assez",
                                "url": "https://lassez.fr",
                                "logo": "https://lassez.fr/android-chrome-512x512.png",
                                "sameAs": [
                                    "https://twitter.com/lasse_media",
                                    "https://www.linkedin.com/company/lassez/"
                                ],
                                "description": "Journalisme d'investigation indépendant en lutte pour la vérité."
                            })}
                        </Script>
                        <Script id="structured-data-website" type="application/ld+json" strategy="beforeInteractive">
                            {JSON.stringify({
                                "@context": "https://schema.org",
                                "@type": "WebSite",
                                "name": "L'Assez",
                                "url": "https://lassez.fr",
                                "potentialAction": {
                                    "@type": "SearchAction",
                                    "target": "https://lassez.fr/search?q={search_term_string}",
                                    "query-input": "required name=search_term_string"
                                }
                            })}
                        </Script>

                        <CommunicationLayer config={config} />
                        <NavProvider initialNavItems={navItems}>
                            <div id="root">
                                {children}
                            </div>
                        </NavProvider>
                    </>
                )}

                {controlPlaneRequest && children}
            </body>
        </html>
    );
}
