/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ['better-sqlite3'],
    },
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'admin.lassez.fr' },
            { protocol: 'https', hostname: 'api.lassez.fr' },
            { protocol: 'https', hostname: 'lassez.fr' },
            { protocol: 'https', hostname: '**.lassez.fr' },
            { protocol: 'https', hostname: 'secure.gravatar.com' },
        ],
    },
    // ffmpeg-static fournit un binaire natif — ne pas bundler avec webpack
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals = [
                ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
                'ffmpeg-static',
            ];
        }
        return config;
    },
    // Ensure we don't block Matomo script and allow SharedArrayBuffer for FFmpeg.WASM
    async headers() {
        return [
            {
                // Headers globaux (Site entier)
                source: '/(.*)',
                headers: [
                    {
                        key: 'X-Frame-Options',
                        value: 'SAMEORIGIN',
                    },
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
                        value: "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://stats.lassez.fr http://stats.lassez.fr blob:; worker-src 'self' blob:; connect-src 'self' https://api.lassez.fr https://unpkg.com https://stats.lassez.fr http://stats.lassez.fr https://fonts.googleapis.com https://fonts.gstatic.com blob: data:; img-src 'self' blob: data: https:; media-src 'self' blob: data: https:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com; upgrade-insecure-requests;",

                    }
                ],
            },
            {
                // Headers hyper stricts UNIQUEMENT pour le Studio (FFmpeg.wasm nécessite SharedArrayBuffer)
                source: '/radar-admin/studio(.*)',
                headers: [
                    {
                        key: 'Cross-Origin-Opener-Policy',
                        value: 'same-origin',
                    },
                    {
                        key: 'Cross-Origin-Embedder-Policy',
                        value: 'require-corp',
                    },
                ],
            },
        ];
    },
    async redirects() {
        return [
            {
                source: '/elections/municipales-2026/:ville((?!commune).*)',
                destination: '/elections/municipales-2026',
                permanent: true,
            },
        ];
    },
};

export default nextConfig;
