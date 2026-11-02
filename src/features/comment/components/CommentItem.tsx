import { useState } from 'react';
import { MarkdownContent } from '../../../shared/components/richText/MarkdownContent';
import type { CommentEntity } from '../types/comment.types';
import { CommentForm } from './CommentForm';
import ui from '../../../shared/styles/Controls.module.css';
import styles from './Comments.module.css';

interface CommentItemProps {
  comment: CommentEntity;
  userId: number | null;
  postAuthorId: number;
  busy: boolean;
  onReply: (id: number, content: string) => Promise<void>;
  onUpdate: (id: number, content: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}

/** 댓글 한 개의 표시/편집 전환을 담당한다. 답글 배치는 목록이 담당해 재귀 UI의 무제한 들여쓰기를 피한다. */
export const CommentItem = ({ comment, userId, postAuthorId, busy, onReply, onUpdate, onRemove }: CommentItemProps) => {
  const [mode, setMode] = useState<'read' | 'reply' | 'edit'>('read');
  const [error, setError] = useState<string | null>(null);
  const hidden = comment.is_deleted || comment.is_blurred;
  const owned = userId === comment.user_id;

  /** 삭제 여부는 서버 성공 후에만 목록에 반영한다. 현재 API가 대댓글까지 삭제함을 반드시 고지한다. */
  const remove = async () => {
    // TODO(backend-reply-preservation): 부모 자리와 답글을 보존하는 API 합의 후 문구/연쇄 삭제를 함께 변경한다.
    const warning = comment.parent_comment_id === null
      ? '이 댓글과 아래 답글이 함께 삭제됩니다. 다른 사람이 작성한 답글도 삭제될 수 있습니다. 삭제하시겠습니까?'
      : '이 답글을 삭제하시겠습니까?';
    if (busy || !window.confirm(warning)) return;
    setError(null);
    try { await onRemove(comment.id); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : '댓글 삭제에 실패했습니다.'); }
  };

  return <article className={styles.item} aria-label={comment.is_deleted ? '삭제된 댓글' : `${comment.username}의 댓글`}>
    <header className={styles.meta}>
      <strong>{comment.is_deleted ? '삭제된 댓글' : comment.username}</strong>
      {!comment.is_deleted && <span>@{comment.account_id}</span>}
      {!comment.is_deleted && comment.user_id === postAuthorId && <span className={ui.badge}>글쓴이</span>}
      <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString('ko-KR')}</time>
      {!comment.is_deleted && comment.updated_at !== comment.created_at && <span>수정됨</span>}
    </header>

    {hidden ? <p>{comment.is_deleted ? '삭제된 댓글입니다.' : '숨김 처리된 댓글입니다.'}</p>
      : mode === 'edit' ? <CommentForm label="댓글 수정" initialContent={comment.content} disabled={busy}
        onSave={(content) => onUpdate(comment.id, content)} onSaved={() => setMode('read')} onCancel={() => setMode('read')} />
      : <MarkdownContent content={comment.content} />}

    {!comment.is_deleted && mode !== 'edit' && <div className={ui.actions}>
      {!hidden && userId !== null && comment.parent_comment_id === null && <button type="button" className={ui.button}
        disabled={busy || mode === 'reply'} onClick={() => setMode('reply')}>답글</button>}
      {owned && !hidden && <button type="button" className={ui.button} disabled={busy || mode === 'reply'} onClick={() => setMode('edit')}>수정</button>}
      {owned && <button type="button" className={ui.button} disabled={busy} onClick={() => void remove()}>삭제</button>}
    </div>}
    {error && <p role="alert" className={ui.error}>{error}</p>}
    {!hidden && mode === 'reply' && <CommentForm label={`${comment.username}에게 답글`} disabled={busy}
      onSave={(content) => onReply(comment.id, content)} onSaved={() => setMode('read')} onCancel={() => setMode('read')} />}
  </article>;
};
