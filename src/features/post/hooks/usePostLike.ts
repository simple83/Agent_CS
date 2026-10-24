import { useCallback, useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';

/** 개인별 상태와 합계를 분리한다. 조회 실패를 '좋아요하지 않음'으로 오인하지 않도록 상태를 구분한다. */
interface LikeState {
  postId: number;
  initialCount: number;
  count: number;
  liked: boolean | null;
  status: 'loading' | 'guest' | 'ready' | 'saving' | 'error';
  error: string | null;
}

/** 상세 응답의 합계로 시작하되, 내 좋아요 여부는 서버 확인 전까지 미확정으로 둔다. */
const initialState = (postId: number, count: number): LikeState => ({
  postId, initialCount: count, count, liked: null, status: 'loading', error: null,
});

/**
 * 상세 화면의 좋아요 상태 조회와 등록/취소를 담당한다. 카드/목록에서는 사용하지 않는다.
 * 변경 요청 성공 후에만 합계를 조정하며, 상세를 다시 조회하지 않아 조회수를 추가로 올리지 않는다.
 * 합계는 상세 조회 시점의 값에 내 변경만 반영한다. 다른 사용자의 동시 변경은 다음 상세 조회에 반영된다.
 */
export const usePostLike = (postId: number, initialCount: number) => {
  const [state, setState] = useState(() => initialState(postId, initialCount));
  const requestId = useRef(0);
  const saving = useRef(false);

  // 같은 컴포넌트에서 다른 글/새 상세 응답을 받더라도 이전 글의 버튼 상태를 표시하지 않는다.
  if (state.postId !== postId || state.initialCount !== initialCount) {
    setState(initialState(postId, initialCount));
  }

  /**
   * 현재 사용자의 상태를 읽는다. 실패 후 재확인할 때 이전 상태와 다르면 합계도 한 번만 보정한다.
   * 서버 저장 후 통신이 끊긴 경우에도 변경 요청을 무조건 재전송하지 않고 먼저 상태를 확인한다.
   */
  const loadStatus = useCallback(async () => {
    const currentRequest = ++requestId.current;
    try {
      const liked = await postApi.getLikeStatus(postId);
      if (currentRequest !== requestId.current) return;
      setState((previous) => ({
        ...previous,
        count: Math.max(0, previous.count + (previous.liked !== null && liked !== null
          ? Number(liked) - Number(previous.liked) : 0)),
        liked,
        status: liked === null ? 'guest' : 'ready',
        error: null,
      }));
    } catch (error: unknown) {
      if (currentRequest !== requestId.current) return;
      setState((previous) => ({ ...previous, status: 'error',
        error: error instanceof Error ? error.message : '좋아요 상태를 확인하지 못했습니다.' }));
    }
  }, [postId]);

  // 화면 이동/언마운트 이후 도착한 응답은 무시한다. StrictMode의 이전 요청도 여기서 무효화한다.
  useEffect(() => {
    saving.current = false;
    void loadStatus();
    return () => { requestId.current += 1; };
  }, [loadStatus, initialCount]);

  /** 오류 시 현재 상태를 다시 확인한다. 변경 요청 중에는 재조회와 변경 요청이 경합하지 않게 한다. */
  const retry = () => {
    if (saving.current) return;
    setState((previous) => ({ ...previous, status: 'loading', error: null }));
    return loadStatus();
  };

  /**
   * 확인된 개인별 상태에 따라 등록 또는 취소 API를 선택한다.
   * ref 잠금으로 같은 렌더 안의 연속 클릭도 차단한다. 실패 시 합계/본문은 유지하고 재확인을 안내한다.
   */
  const toggle = async () => {
    if (saving.current || state.status !== 'ready' || state.liked === null) return;
    saving.current = true;
    const currentRequest = ++requestId.current;
    const wasLiked = state.liked;
    setState((previous) => ({ ...previous, status: 'saving', error: null }));
    try {
      if (wasLiked) await postApi.unlikePost(postId);
      else await postApi.likePost(postId);
      if (currentRequest !== requestId.current) return;
      setState((previous) => ({ ...previous, liked: !wasLiked,
        count: Math.max(0, previous.count + (wasLiked ? -1 : 1)), status: 'ready' }));
    } catch (error: unknown) {
      if (currentRequest !== requestId.current) return;
      setState((previous) => ({ ...previous, status: 'error',
        error: error instanceof Error ? error.message : '좋아요 변경에 실패했습니다.' }));
    } finally {
      if (currentRequest === requestId.current) saving.current = false;
    }
  };

  return { ...state, toggle, retry };
};
