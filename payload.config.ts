import path from 'path';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor, lexicalHTML, HTMLConverterFeature } from '@payloadcms/richtext-lexical';

import { categories } from './payload/collections/categories';
import { tags } from './payload/collections/tags';
import { authors } from './payload/collections/authors';
import { media } from './payload/collections/media';
import { posts } from './payload/collections/posts';
import { lessons } from './payload/collections/lessons';
import { revelations } from './payload/collections/revelations';
import { settings } from './payload/globals/settings';
import { about } from './payload/globals/about';
import { legal } from './payload/globals/legal';
import { seoPlugin } from '@payloadcms/plugin-seo';
import { getApiOrigin, getPublicSiteOrigin } from './lib/host-urls';
import { generateGeminiSeo } from './payload/hooks/seo-gemini';

function extractSeoSource(doc: Record<string, any> | undefined) {
    const source = doc || {};
    const title = String(source.title || source.titre || source.seoTitle || source.meta?.title || '').trim();
    const body = [
        source.excerpt,
        source.content,
        source.content_html,
        source.contenu_rapide,
        source.contenu_rapide_html,
    ]
        .filter(Boolean)
        .map(value => String(value).trim())
        .join('\n\n');

    return { title, body };
}

const rootDir = path.dirname(new URL(import.meta.url).pathname);

export default buildConfig({
    secret: process.env.PAYLOAD_SECRET || 'change-me-in-production',
    serverURL: process.env.PAYLOAD_SERVER_URL || getApiOrigin(),
    admin: {
        user: 'authors',
        theme: 'all',
        meta: {
            titleSuffix: 'Payload',
        },
        livePreview: {
            collections: ['posts', 'lessons', 'revelations'],
            breakpoints: [
                {
                    label: 'Mobile',
                    name: 'mobile',
                    width: 375,
                    height: 667,
                },
                {
                    label: 'Tablet',
                    name: 'tablet',
                    width: 768,
                    height: 1024,
                },
                {
                    label: 'Desktop',
                    name: 'desktop',
                    width: 1440,
                    height: 900,
                },
            ],
        },
    },
    cors: {
        origins: [
            getPublicSiteOrigin(),
            getApiOrigin(),
            'http://api.localhost:5173',
            'https://lassez.fr',
            'https://api.lassez.fr',
            'https://studio.lassez.fr',
            'https://*.lassez.fr',
        ],
        headers: ['Content-Type', 'Authorization'],
    },
    csrf: [
        getPublicSiteOrigin(),
        getApiOrigin(),
        'http://api.localhost:5173',
        'https://lassez.fr',
        'https://api.lassez.fr',
        'https://studio.lassez.fr',
        'https://*.lassez.fr',
    ],
    telemetry: false,
    editor: lexicalEditor({
        features: ({ defaultFeatures }) => [...defaultFeatures, HTMLConverterFeature({  })],
    }),
    db: postgresAdapter({
        push: false,
        pool: {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            min: 2,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        },
        migrationDir: path.resolve(process.cwd(), 'payload/migrations'),
    }),
    globals: [settings, about, legal],
    collections: [categories, tags, authors, media, posts, lessons, revelations],
    plugins: [
        seoPlugin({
            collections: ['posts', 'lessons', 'revelations'],
            uploadsCollection: 'media',
            generateTitle: async ({ doc, collectionSlug }: any) => {
                const { title, body } = extractSeoSource(doc);
                const seo = await generateGeminiSeo({
                    collectionLabel: String(collectionSlug || 'content'),
                    title,
                    body,
                });

                return seo?.meta_title || seo?.seo_title || `${title || doc?.meta?.title || doc?.seoTitle || ''} | l'Assez`;
            },
            generateDescription: async ({ doc, collectionSlug }: any) => {
                const { title, body } = extractSeoSource(doc);
                const seo = await generateGeminiSeo({
                    collectionLabel: String(collectionSlug || 'content'),
                    title,
                    body,
                });

                return seo?.meta_description || seo?.seo_description || String(doc?.meta?.description || doc?.seoDescription || doc?.excerpt || doc?.content || doc?.contenu_rapide || '').trim();
            },
        }),
    ],
    typescript: {
        outputFile: path.resolve(process.cwd(), 'payload-types.ts'),
    },
    routes: {
        admin: '/admin',
        api: '/api/payload',
        graphQL: '/api/payload-graphql',
        graphQLPlayground: '/api/payload-graphql-playground',
    },
});