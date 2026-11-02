import { useEffect, useRef, useState } from 'react';
import { validateCommentContent } from '../utils/comments';

/**
 * 작성·답글·수정의 초안을 관리한다. 초기값은 최초에만 읽어 목록 재조회가 초안을 덮어쓰지 않는다.
 * 다른 글/계정/수정 대상은 부모가 key로 분리하며, 실패 시 입력을 보존한다.
 */
export const useCommentForm = (initialContent: string, onSave: (content: string) => Promise<void>, onSaved?: () => void) => {
  const [content, setContent] = useState(initialContent);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const active = useRef(false);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  /** 줄바꿈/들여쓰기 원문을 전송한다. API 성공 전에는 입력을 비우지 않는다. */
  const submit = async () => {
    if (locked.current) return;
    try { validateCommentContent(content); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : '입력을 확인해주세요.'); return; }
    locked.current = true;
    setSaving(true);
    setError(null);
    try {
      await onSave(content);
      if (!active.current) return;
      setContent('');
      onSaved?.();
    } catch (err: unknown) {
      if (active.current) setError(err instanceof Error ? err.message : '댓글 저장에 실패했습니다.');
    } finally {
      locked.current = false;
      if (active.current) setSaving(false);
    }
  };

  return { content, setContent, error, saving, submit };
};
