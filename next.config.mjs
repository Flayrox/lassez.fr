const isProd = process.env.NODE_ENV === 'production';
const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self' https://lassez.fr https://*.lassez.fr http://localhost:2500 https://localhost:2500",
    "frame-ancestors 'self' https://lassez.fr https://*.lassez.fr http://localhost:2500 https://localhost:2500",
    "object-src 'none'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://stats.lassez.fr http://stats.lassez.fr blob:",
    "worker-src 'self' blob:",
    "connect-src * 'self' blob: data:",
    `img-src * 'self' blob: data:`,
    `media-src * 'self' blob: data:`,
    "font-src * 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    ...(isProd ? ['upgrade-insecure-requests'] : []),
];

const contentSecurityPolicy = `${cspDirectives.join('; ')};`;

/** @type {import('next').NextConfig} */
const nextConfig = {
    poweredByHeader: false,
    compress: true,
    // Dev sur domaine .test (scripts/dev-domain.sh + Caddy local) :
    // autorise lassez.test et ses sous-domaines à interroger le dev server.
    allowedDevOrigins: ['lassez.test', '*.lassez.test'],
    // standalone pour VPS (docker-lite)
    output: 'standalone',
    // elections utilisent encore better-sqlite3 (sera refacto après)
    serverExternalPackages: ['better-sqlite3', 'sharp'],
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'lassez.fr' },
            { protocol: 'https', hostname: '**.lassez.fr' },
            { protocol: 'https', hostname: 'secure.gravatar.com' },
            { protocol: 'https', hostname: 'picsum.photos' },
            { protocol: 'https', hostname: 'fastly.picsum.photos' },
        ],
        formats: ['image/avif', 'image/webp'],
        minimumCacheTTL: 60 * 60 * 24 * 7, // 7j cache image
    },
    async headers() {
        return [
            {
                // Headers globaux (Site entier)
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=()',
                    },
                    {
                        key: 'Content-Security-Policy',
                        value: contentSecurityPolicy,

                    }
                ],
            },
            // Studio/Radar supprimés — plus de headers COOP/COEP
        ];
    },
};

export default nextConfig;
