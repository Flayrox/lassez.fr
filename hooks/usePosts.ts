
import useSWR from 'swr';
import { WPPost } from '../types';
import { fetcher, WP_API_URL } from '../lib/api';

export function usePosts(params: string | null) {
    const endpoint = params ? `/posts?${params}` : null;
    const { data, error, isLoading } = useSWR<WPPost[]>(endpoint ? `${WP_API_URL}${endpoint}` : null, fetcher);

    return {
        data,
        isLoading,
        error
    };
}
