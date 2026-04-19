'use client';

import { useEffect, useState } from 'react';
import ArticleClient from '@/components/ArticleClient';
import { getApiOrigin } from '@/lib/host-urls';
import { Post } from '@/payload-types';

export default function HeadersOriginComponent({ post, slug, isPreview }: { post: Post; slug: string; isPreview: boolean }) {
    const [origin, setOrigin] = useState('');

    useEffect(() => {
        setOrigin(window.location.origin);
    }, []);

    if (!origin) {
        return null;
    }

    return (
        <ArticleClient
            post={post as any}
            relatedPosts={[]}
            slug={slug}
            isPreview={isPreview}
            livePreviewServerURL={origin || getApiOrigin()}
            variant="editorial"
        />
    );
}