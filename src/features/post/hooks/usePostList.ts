import { useCallback, useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { PostEntity, PostQueryParams } from '../types/post.types';

/**
 * 목록의 최초 조회·검색·재조회를 구분해 관리한다. 처음에는 빈 목록이 아니라 로딩 상태로 시작한다.
 * 요청 번호를 비교해 늦게 도착한 이전 응답이 최신 검색 결과를 덮어쓰지 못하게 한다.
 */
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

  /** API 요청마다 번호를 올린다. 최신 요청의 성공/실패만 반영하며 실제 네트워크를 취소하지는 않는다. */
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

  // 마운트 시 한 번 조회한다. 초기 조건은 고정되어 렌더마다 새 객체를 전달해도 재요청하지 않는다.
  useEffect(() => {
    void fetchPosts(initialFilters);
    return () => {
      // 언마운트 및 StrictMode의 이전 Effect에서 시작한 응답을 무시한다.
      requestId.current += 1;
    };
  }, [fetchPosts, initialFilters]);

  /** 공백 검색값을 정규화해 현재 조건으로 보관하고 새 검색을 시작한다. 이전 오류는 지운다. */
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

  /** 마지막 검색 조건 그대로 재조회한다. 실패 후 재시도에서도 조건이 초기화되지 않는다. */
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
