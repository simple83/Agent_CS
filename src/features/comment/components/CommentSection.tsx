import { useEffect, useState } from 'react';
import { useAuthUserId } from '../../auth/hooks/useAuthSession';
import { useComments } from '../hooks/useComments';
import { groupComments } from '../utils/comments';
import { CommentItem } from './CommentItem';
import { CommentForm } from './CommentForm';
import ui from '../../../shared/styles/Controls.module.css';
import styles from './Comments.module.css';

interface CommentSectionProps {
  postId: number;
  postAuthorId: number;
  onCountChange: (count: number) => void;
}

/** 글/계정별 목록과 초안을 격리한다. 페이지 이동과 인증 변경 때 이전 입력을 다른 계정에 넘기지 않는다. */
const CommentSectionSession = ({ postId, postAuthorId, onCountChange, userId }: CommentSectionProps & { userId: number | null }) => {
  const { comments, loading, error, pending, refresh, create, reply, update, remove } = useComments(postId, userId);
  const [writing, setWriting] = useState(false);
  const count = comments === null ? null : comments.filter((comment) => !comment.is_deleted).length;

  // 전체 목록 응답 기준의 유효 댓글 수를 부모에 전달한다. 초기 조회 실패를 0개로 오인하지 않는다.
  // TODO(backend-contract): 페이지네이션 도입 시 전체 개수는 서버 total 값을 사용해야 한다.
  useEffect(() => {
    if (count !== null) onCountChange(count);
  }, [count, onCountChange]);

  const groups = groupComments(comments ?? []);
  const itemProps = { userId, postAuthorId, busy: pending, onReply: reply, onUpdate: update, onRemove: remove };

  return <section className={styles.section} aria-label="댓글">
    <header className={styles.heading}>
      <h2>댓글{count === null ? '' : ` ${count}개`}</h2>
      {/* 상단 오른쪽에 새로고침·작성 버튼을 모아 댓글 끝까지 내려가지 않고 작성할 수 있게 한다. */}
      <div className={`${ui.actions} ${styles.headingActions}`}>
        <button type="button" className={ui.button} disabled={pending || loading} onClick={refresh}>댓글 새로고침</button>
        {userId !== null && !writing && <button type="button" className={`${ui.button} ${ui.primary}`} disabled={comments === null}
          onClick={() => setWriting(true)}>댓글 작성</button>}
      </div>
    </header>
    {loading && <p role="status">댓글을 불러오는 중입니다...</p>}
    {error && <div role="alert" className={ui.error}>
      <p>{error}</p>
      <button type="button" className={ui.button} disabled={pending || loading} onClick={refresh}>댓글 다시 불러오기</button>
    </div>}
    {comments !== null && count === 0 && <p>아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>}

    {/* 편집기도 상단 버튼 아래에 열어 작성 시작 시 별도 스크롤이 필요하지 않게 한다. */}
    {userId === null ? <p>로그인하면 댓글과 답글을 작성할 수 있습니다.</p>
      : writing && <CommentForm label="댓글 작성" disabled={pending || comments === null}
        // 등록 성공 때만 폼을 닫는다. 실패하면 입력 내용과 오류가 유지된다.
        onSave={create} onSaved={() => setWriting(false)} onCancel={() => setWriting(false)} />}

    <ul className={styles.list}>
      {groups.map(({ root, replies }) => <li key={root.id}>
        {root.parent_comment_id !== null && <p className={ui.help}>원본 댓글을 확인할 수 없는 답글입니다.</p>}
        <CommentItem comment={root} {...itemProps} />
        {replies.length > 0 && <ul className={styles.replies}>
          {replies.filter((comment) => !comment.is_deleted).map((comment) => <li key={comment.id}>
            <CommentItem comment={comment} {...itemProps} />
          </li>)}
        </ul>}
      </li>)}
    </ul>

  </section>;
};

/** 상세 본문과 독립된 댓글 경계다. 조회 오류는 이 영역 안에서만 표시한다. */
export const CommentSection = (props: CommentSectionProps) => {
  const userId = useAuthUserId();
  return <CommentSectionSession key={`${props.postId}:${userId ?? 'guest'}`} {...props} userId={userId} />;
};
