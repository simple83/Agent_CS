import { getPostBoardTag, type PostBoardTag } from '../utils/postEditor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { PostSummary, PostQueryParams } from '../types/post.types';

/**
 * 목록의 최초 조회·검색·재조회를 구분해 관리한다. 처음에는 빈 목록이 아니라 로딩 상태로 시작한다.
 * 요청 번호를 비교해 늦게 도착한 이전 응답이 최신 검색 결과를 덮어쓰지 못하게 한다.
 */
export const usePostList = (initialParams: PostQueryParams = {}, boardTag: PostBoardTag | '' = '') => {
  // initialParams는 최초 조회 조건이다. 이후 조건 변경은 search로 처리한다.
  const [initialFilters] = useState(initialParams);
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [filters, setFilters] = useState<PostQueryParams>(initialFilters);
  const [status, setStatus] = useState<
    'initial-loading' | 'searching' | 'refreshing' | 'success' | 'error'
  >('initial-loading');
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const nextOffset = useRef(0);
  const loadingPage = useRef(false);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = initialFilters.limit ?? 20;

  /** API 요청마다 번호를 올린다. 최신 요청의 성공/실패만 반영하며 실제 네트워크를 취소하지는 않는다. */
  const fetchPosts = useCallback((params: PostQueryParams, append = false) => {
    const currentRequestId = ++requestId.current;

    loadingPage.current = true;
    const limit = params.limit ?? pageSize;
    const offset = append ? nextOffset.current : (params.offset ?? 0);
    // 태그 API는 한 개만 검색한다. 주제와 말머리의 교집합은 페이지를 계속 읽으며 적용한다.
    // 자유 말머리는 태그 없는 과거 글도 포함하는 UI 규칙이어서 전체를 받아 화면에서 분류한다.
    const tag = params.tag || (boardTag && boardTag !== '자유' ? boardTag : undefined);
    return postApi.getPosts({ ...params, tag, limit, offset }).then(
      (data) => {
        if (currentRequestId !== requestId.current) return;
        nextOffset.current = offset + data.length;
        setHasMore(data.length === limit);
        const visible = data.filter((post) => !boardTag || getPostBoardTag(post.hashtags) === boardTag);
        setPosts((previous) => append ? [...previous, ...visible.filter((post) => !previous.some((item) => item.id === post.id))] : visible);
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
    ).finally(() => { if (currentRequestId === requestId.current) loadingPage.current = false; });
  }, [boardTag, pageSize]);

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
      sort: params.sort,
      limit: params.limit,
      offset: 0,
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

  /** 서버 전체 개수를 추측하지 않는다. 마지막 페이지가 가득 찼으면 다음 범위를 조회할 수 있다. */
  const loadMore = () => {
    if (loadingPage.current || !hasMore) return;
    setStatus('refreshing');
    setError(null);
    return fetchPosts(filters, true);
  };

  return {
    posts, hasMore, loadMore,
    filters,
    status,
    isLoading: status === 'initial-loading' || status === 'searching' || status === 'refreshing',
    isInitialLoading: status === 'initial-loading',
    error,
    search,
    refresh,
  };
};
