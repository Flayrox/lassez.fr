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
import { seoPlugin } from '@payloadcms/plugin-seo';
import { getApiOrigin, getPublicSiteOrigin } from './lib/host-urls';

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
            url: 'http://localhost:5173',
            collections: ['posts', 'lessons', 'revelations'],
        },
    },
    cors: {
        origins: [
            getPublicSiteOrigin(),
            getApiOrigin(),
            'http://api.localhost:5173',
            'https://lassez.fr',
            'https://api.lassez.fr',
        ],
        headers: ['Content-Type', 'Authorization'],
    },
    csrf: [
        getPublicSiteOrigin(),
        getApiOrigin(),
        'http://api.localhost:5173',
        'https://lassez.fr',
        'https://api.lassez.fr',
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
    globals: [settings],
    collections: [categories, tags, authors, media, posts, lessons, revelations],
    plugins: [
        seoPlugin({
            collections: ['posts', 'lessons', 'revelations'],
            uploadsCollection: 'media',
            generateTitle: ({ doc }: any) => `${doc?.title || doc?.titre || ''} - LASSEZ`,
            generateDescription: ({ doc }: any) => doc?.excerpt || doc?.content || doc?.contenu_rapide || '',
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