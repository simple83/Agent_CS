import { useCallback, useEffect, useRef, useState } from 'react';
import { authStorage } from '../../../shared/services/authStorage';
import { commentApi } from '../services/commentApi';
import type { CommentEntity } from '../types/comment.types';
import { getCommentSubtreeIds } from '../utils/comments';

interface CommentState {
  comments: CommentEntity[] | null;
  loading: boolean;
  error: string | null;
}

/**
 * 댓글만 조회·갱신한다. 게시글 상세 API를 호출하지 않아 댓글 작업이 조회수를 올리지 않는다.
 * 이 Hook의 소유 컴포넌트는 postId/userId를 key로 사용한다. 늦은 조회는 세대 번호로 무시하고,
 * 변경은 한 번에 하나만 허용해 오래된 목록이 새 등록/삭제 결과를 덮어쓰는 일을 막는다.
 */
export const useComments = (postId: number, userId: number | null) => {
  const [state, setState] = useState<CommentState>({ comments: null, loading: true, error: null });
  const [pending, setPending] = useState(false);
  const active = useRef(false);
  const generation = useRef(0);
  const locked = useRef(false);

  /** 목록 재조회 실패는 기존 목록을 유지한다. 변경 후 실패 문구는 저장 실패와 명확히 구분한다. */
  const load = useCallback((afterMutation = false) => {
    const version = ++generation.current;
    return commentApi.getComments(postId).then((comments) => {
      if (active.current && version === generation.current) setState({ comments, loading: false, error: null });
    }).catch((err: unknown) => {
      if (!active.current || version !== generation.current) return;
      const message = err instanceof Error ? err.message : '댓글을 불러오지 못했습니다.';
      setState((previous) => ({ ...previous, loading: false,
        error: afterMutation ? `댓글 변경은 완료되었습니다. 목록 갱신에 실패했습니다. 새로고침으로 확인해주세요. ${message}` : message }));
    });
  }, [postId]);

  useEffect(() => {
    active.current = true;
    void load();
    return () => { active.current = false; generation.current += 1; };
  }, [load]);

  /** 사용자 새로고침은 진행 중 변경과 겹치지 않으며 입력 폼을 초기화하지 않는다. */
  const refresh = () => {
    if (locked.current) return;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    void load();
  };

  /**
   * 성공 응답만 목록에 반영한 뒤 서버 목록을 다시 맞춘다. 후속 GET 실패는 POST 실패로 전파하지 않는다.
   * 변경 요청 실패는 호출한 폼에 전달하여 초안을 유지한다. 응답 유실 시 자동 재전송하지 않는다.
   */
  const mutate = async (operation: () => Promise<CommentEntity | void>, deletedId?: number) => {
    if (locked.current) throw new Error('다른 댓글 요청이 처리 중입니다. 잠시 후 다시 시도해주세요.');
    if (userId === null || !authStorage.getAccessToken() || authStorage.getUserId() !== userId) {
      throw new Error('로그인 계정이 변경되었습니다. 현재 계정으로 다시 시도해주세요.');
    }
    locked.current = true;
    generation.current += 1;
    setPending(true);
    try {
      const saved = await operation();
      if (!active.current) return;
      setState((previous) => {
        let comments = previous.comments ?? [];
        if (deletedId !== undefined) {
          // TODO(backend-reply-preservation): 부모만 삭제하도록 합의되면 이 연쇄 제거도 자리 표시 방식으로 바꾼다.
          const removed = getCommentSubtreeIds(comments, deletedId);
          comments = comments.filter((comment) => !removed.has(comment.id));
        } else if (saved) {
          comments = [...comments.filter((comment) => comment.id !== saved.id), saved]
            .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
        }
        return { comments, loading: false, error: null };
      });
      await load(true);
    } finally {
      locked.current = false;
      if (active.current) {
        setPending(false);
        setState((previous) => ({ ...previous, loading: false }));
      }
    }
  };

  return { ...state, pending, refresh,
    create: (content: string) => mutate(() => commentApi.createComment(postId, content)),
    reply: (id: number, content: string) => mutate(() => commentApi.createReply(postId, id, content)),
    update: (id: number, content: string) => mutate(() => commentApi.updateComment(postId, id, content)),
    remove: (id: number) => mutate(() => commentApi.deleteComment(postId, id), id),
  };
};
