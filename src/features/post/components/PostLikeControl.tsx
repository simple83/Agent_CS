import { usePostLike } from '../hooks/usePostLike';

/** 상세 본문 아래에만 배치하는 좋아요 도구. 상태 조회/실패/비로그인을 서로 다른 안내로 표시한다. */
export const PostLikeControl = ({ postId, initialCount }: { postId: number; initialCount: number }) => {
  const { count, liked, status, error, toggle, retry } = usePostLike(postId, initialCount);

  return (
    <section className="post-like-control" aria-label="게시글 좋아요">
      <p aria-live="polite">좋아요 {count}개</p>
      {/* 확인된 상태일 때만 변경을 허용한다. 미확정 상태를 false로 표시하거나 낙관적으로 수를 올리지 않는다. */}
      <button type="button" disabled={status !== 'ready'}
        aria-pressed={liked === null ? undefined : liked} onClick={() => void toggle()}>
        {status === 'loading' ? '좋아요 확인 중...' : status === 'saving' ? '처리 중...' : liked ? '좋아요 취소' : '좋아요'}
      </button>
      {status === 'guest' && <p role="status">로그인 후 좋아요를 누를 수 있습니다.</p>}
      {error && <div role="alert">
        <p>{error}</p>
        <button type="button" onClick={() => void retry()}>좋아요 상태 다시 확인</button>
      </div>}
    </section>
  );
};
