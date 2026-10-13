import { useCallback, useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { PostEntity } from '../types/post.types';

interface PostDetailState {
  postId: number;
  post: PostEntity | null;
  status: 'initial-loading' | 'refreshing' | 'success' | 'error';
  error: string | null;
}

const createInitialState = (postId: number): PostDetailState => ({
  postId,
  post: null,
  status: 'initial-loading',
  error: null,
});

export const usePostDetail = (postId: number) => {
  const [state, setState] = useState(() => createInitialState(postId));
  const requestId = useRef(0);

  // 다른 글로 전환되면 Effect 전에 초기화해 이전 글/오류가 표시되지 않게 한다.
  if (state.postId !== postId) {
    setState(createInitialState(postId));
  }

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

  useEffect(() => {
    void fetchPost();
    return () => {
      // 게시글 전환/언마운트 후 도착하는 이전 요청의 응답을 무시한다.
      requestId.current += 1;
    };
  }, [fetchPost]);

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
