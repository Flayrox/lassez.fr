
import useSWR from 'swr';
import { WPCategory } from '../types';
import { fetcher, WP_API_URL } from '../lib/api';

export function useCategories() {
    const { data, error, isLoading } = useSWR<WPCategory[]>(`${WP_API_URL}/categories?per_page=100`, fetcher);

    return {
        categories: data || [],
        isLoading,
        error
    };
}
