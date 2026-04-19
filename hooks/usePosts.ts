import useSWR from 'swr';
import type { Post } from '../payload-types';

const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
});

interface UsePostsOptions {
    page?: number;
    perPage?: number;
    search?: string;
    category?: string | number | null;
    slug?: string;
    depth?: number;
}

interface PayloadResult {
    docs: Post[];
    totalDocs: number;
    totalPages: number;
    page: number;
    hasPrevPage: boolean;
    hasNextPage: boolean;
}

/**
 * Hook de récupération des articles — utilise directement l'API Payload native.
 * Les données sont des `Post` Payload pur, sans transformation WP.
 */
export function usePosts(options: UsePostsOptions | null) {
    const params = options ? new URLSearchParams() : null;

    if (params && options) {
        if (options.page)     params.set('page',       String(options.page));
        if (options.perPage)  params.set('per_page',   String(options.perPage));
        if (options.search)   params.set('search',     options.search);
        if (options.category) params.set('categories', String(options.category));
        if (options.slug)     params.set('slug',       options.slug);
        if (options.depth)    params.set('depth',      String(options.depth));
    }

    const key = params ? `/api/posts?${params.toString()}` : null;

    const { data, error, isLoading } = useSWR<PayloadResult>(key, fetcher, {
        revalidateOnFocus: false,
        dedupingInterval: 30_000,
        keepPreviousData: true,
    });

    return {
        posts:     data?.docs     ?? [],
        total:     data?.totalDocs ?? 0,
        totalPages: data?.totalPages ?? 0,
        isLoading,
        error,
    };
}
