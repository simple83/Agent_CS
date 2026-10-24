import { useCallback, useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { PostEntity } from '../types/post.types';

/** 글 번호와 결과를 함께 저장해 서로 다른 글의 데이터/오류가 섞이지 않도록 한다. */
interface PostDetailState {
  postId: number;
  post: PostEntity | null;
  status: 'initial-loading' | 'refreshing' | 'success' | 'error';
  error: string | null;
}

/** 최초 진입과 다른 글로 이동할 때 사용할 빈 로딩 상태를 만든다. */
const createInitialState = (postId: number): PostDetailState => ({
  postId,
  post: null,
  status: 'initial-loading',
  error: null,
});

/**
 * 상세 조회와 재조회 상태를 관리한다. 글 번호 변경 시 이전 결과를 비우고 최신 요청만 반영한다.
 * 응답 무시는 요청 취소가 아니므로 서버의 조회수 증가까지 되돌리지는 않는다.
 */
export const usePostDetail = (postId: number) => {
  const [state, setState] = useState(() => createInitialState(postId));
  const requestId = useRef(0);

  // 다른 글로 전환되면 Effect 전에 초기화해 이전 글/오류가 표시되지 않게 한다.
  if (state.postId !== postId) {
    setState(createInitialState(postId));
  }

  /** 현재 글을 조회하고 요청 번호가 여전히 최신일 때만 성공/오류 상태를 변경한다. */
  const fetchPost = useCallback(async () => {
    const currentRequestId = ++requestId.current;

    try {
      const post = await postApi.getPost(postId);
      if (currentRequestId !== requestId.current) return;
      setState({ postId, post, status: 'success', error: null });
    } catch (err: unknown) {
      if (currentRequestId !== requestId.current) return;
      setState((previous) => ({
        ...previous,
        status: 'error',
        error: err instanceof Error ? err.message : '게시글을 불러오는 중 오류가 발생했습니다.',
      }));
    }
  }, [postId]);

  // 글 번호 변경으로 fetchPost가 바뀌면 새 글을 조회하고 이전 응답은 정리 함수로 무효화한다.
  useEffect(() => {
    void fetchPost();
    return () => {
      // 게시글 전환/언마운트 후 도착하는 이전 요청의 응답을 무시한다.
      requestId.current += 1;
    };
  }, [fetchPost]);

  /** 기존 글 데이터는 유지하면서 재조회 상태로 전환한다. 실패 시 다시 호출할 수 있다. */
  const refresh = () => {
    setState((previous) => ({ ...previous, status: 'refreshing', error: null }));
    return fetchPost();
  };

  return {
    post: state.post,
    status: state.status,
    isLoading: state.status === 'initial-loading' || state.status === 'refreshing',
    isInitialLoading: state.status === 'initial-loading',
    error: state.error,
    refresh,
  };
};
