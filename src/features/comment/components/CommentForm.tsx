import { lazy, Suspense, type FormEvent } from 'react';
import { useCommentForm } from '../hooks/useCommentForm';
import { COMMENT_MAX_LENGTH, commentLength } from '../utils/comments';
import ui from '../../../shared/styles/Controls.module.css';
import styles from './Comments.module.css';

// 편집기는 댓글 작성/답글/수정을 열었을 때만 로드한다. 코드 실행 확장이나 서버 실행 API는 사용하지 않는다.
const RichTextEditor = lazy(() => import('../../../shared/components/richText/RichTextEditor')
  .then((module) => ({ default: module.RichTextEditor })));

interface CommentFormProps {
  label: string;
  initialContent?: string;
  disabled: boolean;
  onSave: (content: string) => Promise<void>;
  onSaved?: () => void;
  onCancel?: () => void;
}

/** 일반 텍스트·코드블록만 제공하는 댓글 모드를 사용한다. 게시글의 다른 서식 도구는 노출하지 않는다. */
export const CommentForm = ({ label, initialContent = '', disabled, onSave, onSaved, onCancel }: CommentFormProps) => {
  const { content, setContent, error, saving, submit } = useCommentForm(initialContent, onSave, onSaved);
  const busy = disabled || saving;

  /** 브라우저 폼 전송을 막는다. Enter는 편집기 안에서 줄바꿈하며 버튼으로만 등록한다. */
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!busy) void submit();
  };

  return <form onSubmit={handleSubmit} className={styles.form} aria-label={label}>
    <Suspense fallback={<p role="status">댓글 편집기를 준비하는 중입니다...</p>}>
      <RichTextEditor content={content} onChange={setContent} disabled={busy}
        compact variant="comment" label={`${label} 내용`} imageAttachmentAvailable={false} />
    </Suspense>
    <p className={ui.help}>코드블록에서 언어를 선택할 수 있습니다. 코드는 표시·복사만 지원합니다.</p>
    <p className={ui.help}>{commentLength(content).toLocaleString()} / {COMMENT_MAX_LENGTH.toLocaleString()}자 (서식 포함)</p>
    {error && <p role="alert" className={ui.error}>{error}</p>}
    <div className={ui.actions}>
      {onCancel && <button className={ui.button} type="button" disabled={busy} onClick={onCancel}>취소</button>}
      <button className={`${ui.button} ${ui.primary}`} type="submit" disabled={busy || commentLength(content) > COMMENT_MAX_LENGTH}>
        {saving ? '저장 중...' : label === '댓글 수정' ? '수정 저장' : '등록'}
      </button>
    </div>
  </form>;
};
