
import useSWR from 'swr';
import { WPCategory } from '../types';
import { fetcher } from '../lib/api';

export function useCategories() {
    const { data, error, isLoading } = useSWR<WPCategory[]>(`/api/wp/categories?per_page=100`, fetcher);

    return {
        categories: data || [],
        isLoading,
        error
    };
}
