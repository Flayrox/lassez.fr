
import useSWRInfinite from 'swr/infinite';
import { WPPost } from '../types';
import { fetcher, WP_API_URL } from '../lib/api';

const PER_PAGE = 10;

export function useInfinitePosts(baseParams: string = '') {
  const getKey = (pageIndex: number, previousPageData: WPPost[] | null) => {
    if (previousPageData && previousPageData.length === 0) return null; // Reached the end
    const page = pageIndex + 1;
    const params = `per_page=${PER_PAGE}&page=${page}&_embed${baseParams ? `&${baseParams}` : ''}`;
    return `${WP_API_URL}/posts?${params}`;
  };

  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<WPPost[]>(getKey, fetcher);

  const posts = data ? ([] as WPPost[]).concat(...data) : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = data?.[0]?.length === 0;
  const isReachingEnd = isEmpty || (data && (data[data.length - 1]?.length || 0) < PER_PAGE);

  return {
    posts,
    error,
    isLoading: isLoading,
    isLoadingMore,
    isReachingEnd,
    size,
    setSize,
    isValidating,
  };
}
