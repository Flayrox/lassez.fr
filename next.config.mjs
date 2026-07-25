import { withPayload } from '@payloadcms/next/withPayload';

const isProd = process.env.NODE_ENV === 'production';
const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'self' https://lassez.fr https://*.lassez.fr http://localhost:5173 https://localhost:5173 http://127.0.0.1:5173 https://127.0.0.1:5173",
    "frame-ancestors 'self' https://lassez.fr https://*.lassez.fr https://api.lassez.fr https://studio.lassez.fr http://api.localhost:5173 https://api.localhost:5173 http://localhost:5173 https://localhost:5173",
    "object-src 'none'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.tailwindcss.com https://unpkg.com https://stats.lassez.fr http://stats.lassez.fr blob:",
    "worker-src 'self' blob:",
    "connect-src * 'self' blob: data:",
    `img-src * 'self' blob: data:`,
    `media-src * 'self' blob: data:`,
    "font-src * 'self' data:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com",
    ...(isProd ? ['upgrade-insecure-requests'] : []),
];

const contentSecurityPolicy = `${cspDirectives.join('; ')};`;

/** @type {import('next').NextConfig} */
const nextConfig = {
    serverExternalPackages: ['better-sqlite3', 'ffmpeg-static', 'pg', '@google/generative-ai'],
    // turbopack: {},
    images: {
        remotePatterns: [
            { protocol: 'https', hostname: 'admin.lassez.fr' },
            { protocol: 'https', hostname: 'api.lassez.fr' },
            { protocol: 'https', hostname: 'lassez.fr' },
            { protocol: 'https', hostname: '**.lassez.fr' },
            { protocol: 'https', hostname: 'secure.gravatar.com' },
            { protocol: 'https', hostname: 'picsum.photos' },
            { protocol: 'https', hostname: 'fastly.picsum.photos' },
        ],
    },
    // Ensure we don't block Matomo script and allow SharedArrayBuffer for FFmpeg.WASM
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
            {
                // Headers hyper stricts UNIQUEMENT pour le Studio (FFmpeg.wasm nécessite SharedArrayBuffer)
                source: '/templates(.*)',
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
            {
                // Evite l'indexation des surfaces Studio
                source: '/radar-admin/:path*',
                headers: [
                    {
                        key: 'X-Robots-Tag',
                        value: 'noindex, nofollow',
                    },
                ],
            },
            {
                source: '/radar-login',
                headers: [
                    {
                        key: 'X-Robots-Tag',
                        value: 'noindex, nofollow',
                    },
                ],
            },
        ];
    },
};

export default withPayload(nextConfig);
