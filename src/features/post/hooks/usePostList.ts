import { useCallback, useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { PostEntity, PostQueryParams } from '../types/post.types';

export const usePostList = (initialParams: PostQueryParams = {}) => {
  // initialParams는 최초 조회 조건이다. 이후 조건 변경은 search로 처리한다.
  const [initialFilters] = useState(initialParams);
  const [posts, setPosts] = useState<PostEntity[]>([]);
  const [filters, setFilters] = useState<PostQueryParams>(initialFilters);
  const [status, setStatus] = useState<
    'initial-loading' | 'searching' | 'refreshing' | 'success' | 'error'
  >('initial-loading');
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const fetchPosts = useCallback((params: PostQueryParams) => {
    const currentRequestId = ++requestId.current;

    return postApi.getPosts(params).then(
      (data) => {
        if (currentRequestId !== requestId.current) return;
        setPosts(data);
        setStatus('success');
      },
      (err: unknown) => {
        if (currentRequestId !== requestId.current) return;
        setError(
          err instanceof Error
            ? err.message
            : '게시글 목록을 불러오는 중 오류가 발생했습니다.',
        );
        setStatus('error');
      },
    );
  }, []);

  useEffect(() => {
    void fetchPosts(initialFilters);
    return () => {
      // 언마운트 및 StrictMode의 이전 Effect에서 시작한 응답을 무시한다.
      requestId.current += 1;
    };
  }, [fetchPosts, initialFilters]);

  const search = async (params: PostQueryParams) => {
    const normalizedParams = {
      title: params.title?.trim() || undefined,
      tag: params.tag?.trim() || undefined,
    };

    setFilters(normalizedParams);
    setStatus('searching');
    setError(null);
    await fetchPosts(normalizedParams);
  };

  const refresh = () => {
    setStatus('refreshing');
    setError(null);
    return fetchPosts(filters);
  };

  return {
    posts,
    filters,
    status,
    isLoading: status === 'initial-loading' || status === 'searching' || status === 'refreshing',
    isInitialLoading: status === 'initial-loading',
    error,
    search,
    refresh,
  };
};
