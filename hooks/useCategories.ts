import useSWR from 'swr';
import type { Category } from '../payload-types';

const fetcher = (url: string) => fetch(url).then(r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
});

/**
 * Hook de récupération des catégories Payload.
 */
export function useCategories() {
    const { data, error, isLoading } = useSWR<{ docs: Category[] }>(
        '/api/categories?per_page=100',
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 300_000,
        }
    );

    return {
        categories: data?.docs ?? (Array.isArray(data) ? data : []),
        isLoading,
        error,
    };
}
