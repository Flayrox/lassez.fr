
import useSWR from 'swr';
import { WPPost } from '../types';
import { fetcher } from '../lib/api';

export function usePosts(params: string | null) {
    const endpoint = params ? `/posts?${params}` : null;
    const { data, error, isLoading } = useSWR<WPPost[]>(
        endpoint ? `/api/wp${endpoint}` : null,
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 30_000,
            keepPreviousData: true,
        }
    );

    return {
        data,
        isLoading,
        error
    };
}
