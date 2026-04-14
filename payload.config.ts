import path from 'path';
import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';

import { categories } from './payload/collections/categories';
import { tags } from './payload/collections/tags';
import { authors } from './payload/collections/authors';
import { media } from './payload/collections/media';
import { posts } from './payload/collections/posts';
import { getApiOrigin, getPublicSiteOrigin } from './lib/host-urls';

const rootDir = path.dirname(new URL(import.meta.url).pathname);

export default buildConfig({
    secret: process.env.PAYLOAD_SECRET || 'change-me-in-production',
    serverURL: process.env.PAYLOAD_SERVER_URL || getApiOrigin(),
    admin: {
        user: 'authors',
        meta: {
            titleSuffix: 'Payload',
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
    editor: lexicalEditor({}),
    db: postgresAdapter({
        push: true,
        pool: {
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
            max: 20,
            min: 2,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        },
        migrationDir: path.resolve(rootDir, 'payload/migrations'),
    }),
    collections: [categories, tags, authors, media, posts],
    typescript: {
        outputFile: path.resolve(rootDir, 'payload-types.ts'),
    },
    routes: {
        admin: '/admin',
        api: '/api/payload',
        graphQL: '/api/payload-graphql',
        graphQLPlayground: '/api/payload-graphql-playground',
    },
});