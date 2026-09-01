import { useCallback, useEffect, useState } from 'react';
import { postApi } from '../services/postApi';
import type { PostEntity, PostQueryParams } from '../types/post.types';

export const usePostList = (initialParams: PostQueryParams = {}) => {
  const [posts, setPosts] = useState<PostEntity[]>([]);
  const [filters, setFilters] = useState<PostQueryParams>(initialParams);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPosts = useCallback(async (params: PostQueryParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await postApi.getPosts(params);
      setPosts(data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : '게시글 목록을 불러오는 중 오류가 발생했습니다.',
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPosts(initialParams);
    // 최초 진입 시 initialParams 기준으로 한 번만 조회한다.
    // 호출 측에서 동적으로 initialParams를 바꿀 필요가 생기면 별도 정책을 정하는 편이 안전하다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPosts]);

  const search = async (params: PostQueryParams) => {
    const normalizedParams = {
      title: params.title?.trim() || undefined,
      tag: params.tag?.trim() || undefined,
    };

    setFilters(normalizedParams);
    await fetchPosts(normalizedParams);
  };

  const refresh = () => fetchPosts(filters);

  return {
    posts,
    filters,
    isLoading,
    error,
    search,
    refresh,
  };
};
