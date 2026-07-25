import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getPayloadClient } from '@/lib/payload';
import { getPreviewContext } from '@/lib/wp-preview';
import { getApiOrigin, getPublicSiteOrigin } from '@/lib/host-urls';
import ArticleClient from '@/components/ArticleClient';
import type { Category, Post } from '@/payload-types';

import HeadersOriginComponent from './HeadersOriginComponent';

type Props = {
    params: Promise<{ slug: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
    },
};

async function getPost(slug: string, isPreview: boolean, previewId?: string | null): Promise<Post | null> {
    const payload = await getPayloadClient();
    
    // If we have a preview ID, prefer looking up by ID since the slug might have changed client-side
    // and hasn't been saved to the database yet.
    if (previewId) {
        try {
            const doc = await payload.findByID({
                collection: 'posts',
                id: previewId,
                depth: 1,
                draft: isPreview,
                overrideAccess: isPreview,
            });
            // Ensure doc actually has the expected slug or is valid
            if (doc) return (doc as Post);
        } catch (error) {
            // Fallback to slug if ID lookup fails
        }
    }

    try {
        const res = await payload.find({
            collection: 'posts',
            where: { slug: { equals: slug } },
            limit: 1,
            depth: 1,
            draft: isPreview,
            overrideAccess: isPreview,
        });

        return (res.docs[0] as Post) || null;
    } catch (e) {
        return null;
    }
}

export default async function ArticleEditorialPreviewPage({ params, searchParams }: Props) {
    const { slug } = await params;
    const resolvedSearchParams = await searchParams;
    const previewId = typeof resolvedSearchParams.preview_id === 'string' ? resolvedSearchParams.preview_id : null;
    
    const isPreview = !!resolvedSearchParams.preview_token;
    const post = await getPost(slug, isPreview, previewId);

    if (!post) {
        return (
            <main className="mx-auto min-h-screen w-full max-w-5xl px-3 py-4 md:px-5 md:py-6 bg-[#f3efe4]">
                 <HeadersOriginComponent 
                    post={{ 
                        id: previewId || 'new', 
                        title: '',
                        slug: slug,
                        _status: 'draft',
                        categories: []
                    } as any} 
                    slug={slug} 
                    isPreview={isPreview} 
                 />
            </main>
        );
    }

    const categories = (Array.isArray(post.categories) ? post.categories : []) as Array<Category | number | string>;
    const firstCategory = categories.find((item): item is Category => typeof item === 'object' && item !== null && 'slug' in item);
    const categorySlug = String(firstCategory?.slug || '').trim() || 'article';
    const publishedHref = `${getPublicSiteOrigin()}/${categorySlug}/${slug}`;

    return (
        <main className="mx-auto min-h-screen w-full max-w-5xl px-3 py-4 md:px-5 md:py-6 bg-[#f3efe4]">
            <div className="mb-3 flex justify-end px-1">
                <Link
                    href={publishedHref}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] font-mono uppercase tracking-[0.22em] text-black/65 underline decoration-black/30 underline-offset-4 transition-colors hover:text-black"
                >
                    Ouvrir publie
                </Link>
            </div>

            <HeadersOriginComponent post={post as any} slug={slug} isPreview={isPreview} />
        </main>
    );
}
