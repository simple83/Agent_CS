import { useEffect, useRef, useState } from 'react';
import { authStorage } from '../../../shared/services/authStorage';
import { postApi } from '../services/postApi';

/**
 * 확인창 이후의 삭제 요청을 관리한다. 동일 글/계정에 대해 마운트된 동안 한 번만 요청하며,
 * 실패하면 재시도할 수 있다. 삭제 성공 후 이동 실패는 재삭제하지 않고 별도로 안내한다.
 * 이 Hook을 쓰는 컴포넌트는 글 번호와 계정 번호를 key로 사용해 다른 글의 상태를 분리한다.
 */
export const usePostDelete = (postId: number, authorId: number, onDeleted: () => void | Promise<void>) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleted, setIsDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = useRef(false);
  const active = useRef(false);

  // 다른 글로 이동하거나 계정이 바뀐 뒤 도착한 응답은 현재 화면을 이동시키지 않는다.
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  /** 확인이 끝난 글만 삭제한다. ref 잠금은 React가 다시 렌더링되기 전의 연속 클릭도 막는다. */
  const deletePost = async () => {
    if (locked.current) return;
    if (!authStorage.getAccessToken() || authStorage.getUserId() !== authorId) {
      setError('본인이 작성한 게시글만 삭제할 수 있습니다. 로그인 계정을 확인해주세요.');
      return;
    }

    locked.current = true;
    setIsDeleting(true);
    setError(null);

    try {
      await postApi.deletePost(postId);
    } catch (err: unknown) {
      locked.current = false;
      if (active.current) {
        setIsDeleting(false);
        setError(err instanceof Error ? err.message : '게시글 삭제 중 오류가 발생했습니다.');
      }
      return;
    }

    if (!active.current) return;
    setIsDeleted(true);
    setIsDeleting(false);

    try {
      await onDeleted();
    } catch {
      // 삭제는 이미 완료되었으므로 잠금을 유지한다. 이동 실패를 API 실패로 취급하지 않는다.
      if (active.current) setError('게시글은 삭제되었습니다. 화면 이동에 실패했으니 상단 메뉴에서 목록으로 이동해주세요.');
    }
  };

  return { deletePost, isDeleting, isDeleted, error };
};
