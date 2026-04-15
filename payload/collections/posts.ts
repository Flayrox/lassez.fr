import type { CollectionConfig } from 'payload';
import { authenticatedOrPublishedPostRead, isAuthenticated } from '../access';

export const posts = {
    slug: 'posts',
    access: {
        read: authenticatedOrPublishedPostRead,
        create: isAuthenticated,
        update: isAuthenticated,
        delete: isAuthenticated,
    },
    admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'slug', 'status', 'publishedAt'],
        description: 'Dossier éditorial avec preview, SEO et taxonomies.',
    },
    versions: {
        drafts: true,
    },
    fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'slug', type: 'text', required: true, unique: true },
        { name: 'excerpt', type: 'textarea' },
        {
            name: 'content',
            type: 'richText',
            required: true,
        },
        {
            name: 'categories',
            type: 'relationship',
            relationTo: 'categories',
            hasMany: true,
            required: true,
        },
        {
            name: 'tags',
            type: 'relationship',
            relationTo: 'tags',
            hasMany: true,
        },
        {
            name: 'author',
            type: 'relationship',
            relationTo: 'authors',
        },
        {
            name: 'featuredImage',
            type: 'upload',
            relationTo: 'media',
        },
        { name: 'publishedAt', type: 'date' },
        {
            name: 'status',
            type: 'select',
            defaultValue: 'draft',
            options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Published', value: 'published' },
            ],
        },
        { name: 'sourcePdfUrl', type: 'text' },
        {
            name: 'securityLevel',
            type: 'select',
            defaultValue: 'PUBLIC',
            options: [
                { label: 'PUBLIC', value: 'PUBLIC' },
                { label: 'CONFIDENTIEL', value: 'CONFIDENTIEL' },
            ],
        },
        { name: 'seoTitle', type: 'text' },
        { name: 'seoDescription', type: 'textarea' },
        { name: 'canonicalUrl', type: 'text' },
        { name: 'chapitre_comprendre', type: 'text' },
        { name: 'lecon_comprendre', type: 'number' },
    ],
} satisfies CollectionConfig;