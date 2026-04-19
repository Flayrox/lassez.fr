
import useSWRInfinite from 'swr/infinite';
import { WPPost } from '../types';
import { fetcher } from '../lib/api';

const PER_PAGE = 10;

type PostsPage = {
  docs: WPPost[];
  totalDocs?: number;
  hasNextPage?: boolean;
};

export function useInfinitePosts(baseParams: string = '') {
  const getKey = (pageIndex: number, previousPageData: PostsPage | null) => {
    if (previousPageData && previousPageData.hasNextPage === false) return null;
    const page = pageIndex + 1;
    const params = `per_page=${PER_PAGE}&page=${page}&depth=1${baseParams ? `&${baseParams}` : ''}`;
    return `/api/posts?${params}`;
  };

  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<PostsPage>(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateFirstPage: false,
      dedupingInterval: 30_000,
      persistSize: true,
    }
  );

  const posts = data ? data.flatMap((pageData) => pageData.docs || []) : [];
  const isLoadingMore = isLoading || (size > 0 && data && typeof data[size - 1] === 'undefined');
  const isEmpty = (data?.[0]?.docs?.length || 0) === 0;
  const isReachingEnd = isEmpty || (data ? data[data.length - 1]?.hasNextPage === false : false);

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
