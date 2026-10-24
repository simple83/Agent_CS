import { lazy, Suspense, useRef, useState } from 'react';
import { CODE_LANGUAGES, codeFence, inlineCode, insertBlock } from '../utils/postEditor';

// 무거운 Markdown/하이라이트 청크는 미리보기를 처음 열 때 로드한다.
// 컴포넌트 바깥에서 선언해야 입력할 때마다 컴포넌트가 새로 만들어지지 않는다.
const Preview = lazy(() => import('./PostContent').then((module) => ({ default: module.PostContent })));

interface PostEditorProps {
  /** API에 저장될 Markdown 원문. 본문 상태의 소유자는 부모 폼이다. */
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
  /** 아직 본문에 넣지 않은 코드. 부모도 이 값을 알아야 누락된 상태로 등록하지 않는다. */
  codeDraft: string;
  onCodeDraftChange: (code: string) => void;
}

/**
 * Markdown 편집을 돕는 Boundary 계층. API나 라우팅은 직접 호출하지 않는다.
 * 본문과 코드 초안은 부모가 보관하고, 이 컴포넌트는 탭/패널/언어/선택 범위를 관리한다.
 * 코드 입력 패널의 내용은 '본문에 코드 삽입'을 눌러야 저장될 Markdown에 합쳐진다.
 */
export const PostEditor = ({ content, onChange, disabled, codeDraft, onCodeDraftChange }: PostEditorProps) => {
  const textarea = useRef<HTMLTextAreaElement>(null);
  // 도구 버튼에 포커스가 옮겨져도 직전 본문 선택 위치를 잃지 않도록 ref에 저장한다.
  const selection = useRef({ start: content.length, end: content.length });
  const [preview, setPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [language, setLanguage] = useState('cpp');

  /** 제어된 textarea에 새 값이 반영된 다음 프레임에 포커스/커서를 되돌린다. */
  const focusAt = (cursor: number) => {
    selection.current = { start: cursor, end: cursor };
    requestAnimationFrame(() => {
      // 프레임 실행 전에 화면을 떠난 경우 ref가 null이므로 아무 작업도 하지 않는다.
      textarea.current?.focus();
      textarea.current?.setSelectionRange(cursor, cursor);
    });
  };

  /** 선택 범위를 문단 단위 블록으로 교체한다. 앞뒤 개행 규칙은 순수 함수에 위임한다. */
  const addBlock = (block: string) => {
    const result = insertBlock(content, selection.current.start, selection.current.end, block);
    onChange(result.content);
    focusAt(result.cursor);
  };

  /** 선택이 없을 때는 빈 문자열을 반환하여 각 도구가 안내 문구를 넣을 수 있게 한다. */
  const selectedText = () => content.slice(selection.current.start, selection.current.end);

  /** 문단 개행을 추가하지 않고 선택 범위를 바꾼다. inline code/굵게/링크가 공유한다. */
  const replaceInline = (text: string) => {
    const { start, end } = selection.current;
    onChange(content.slice(0, start) + text + content.slice(end));
    focusAt(start + text.length);
  };

  /** 선택 문자열을 Markdown 서식으로 감싼다. 선택이 없으면 편집 가능한 예시를 넣는다. */
  const addInline = (before: string, fallback: string, after: string) => {
    replaceInline(before + (selectedText() || fallback) + after);
  };

  /** 패널을 여닫되 기존 코드 초안은 유지한다. 초안이 없을 때만 선택 본문을 가져온다. */
  const toggleCodePanel = () => {
    if (!showCode && !codeDraft && selectedText()) onCodeDraftChange(selectedText());
    setShowCode(!showCode);
  };

  /** 선택한 언어의 코드블록을 본문에 합친 후 임시 입력만 비운다. 언어 선택은 유지한다. */
  const insertCode = () => {
    addBlock(codeFence(codeDraft, language));
    onCodeDraftChange('');
    setShowCode(false);
  };

  return (
    <section className="post-editor" aria-label="본문 편집기">
      <div className="editor-tabs" aria-label="편집 화면 전환">
        <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>작성</button>
        <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>미리보기</button>
      </div>
      {!preview && <>
        {/* 모든 보조 도구는 type=button으로 지정해 부모 form을 뜻하지 않게 제출하지 않는다. */}
        <div className="editor-toolbar" role="group" aria-label="본문 삽입 도구">
          <button type="button" disabled={disabled} onClick={toggleCodePanel}
            aria-expanded={showCode} aria-controls="code-insert-panel">{'</> 코드'}</button>
          <button type="button" disabled={disabled} onClick={() => addInline('**', '강조할 내용', '**')}>굵게</button>
          <button type="button" disabled={disabled} onClick={() => replaceInline(inlineCode(selectedText() || '코드'))}>인라인 코드</button>
          <button type="button" disabled={disabled} onClick={() => addInline('[', '링크 설명', '](https://example.com)')}>링크</button>
          <button type="button" disabled={disabled} onClick={() => addBlock((selectedText() || '목록 내용').split('\n').map((line) => `- ${line}`).join('\n'))}>목록</button>
          <button type="button" disabled={disabled} onClick={() => addBlock((selectedText() || '인용할 내용').split('\n').map((line) => `> ${line}`).join('\n'))}>인용</button>
        </div>
        {showCode && <fieldset id="code-insert-panel" className="code-insert-panel" disabled={disabled}>
          <legend>코드블록 삽입</legend>
          <label>언어
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              {CODE_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>코드 입력
            <textarea value={codeDraft} onChange={(event) => onCodeDraftChange(event.target.value)} rows={7} spellCheck={false} />
          </label>
          <p className="post-help">선택한 본문을 코드블록으로 바꾸거나, 커서 위치에 추가합니다. 오류 로그는 일반 텍스트를 선택하세요.</p>
          <div className="post-actions">
            <button type="button" onClick={() => onCodeDraftChange('')}>입력 비우기</button>
            <button type="button" onClick={() => setShowCode(false)}>닫기</button>
            <button type="button" className="primary" disabled={!codeDraft.trim()} onClick={insertCode}>본문에 코드 삽입</button>
          </div>
        </fieldset>}
        <label className="post-body-label" htmlFor="post-content">내용 *</label>
        <textarea ref={textarea} id="post-content" className="post-body-input" value={content}
          onChange={(event) => {
            // 입력 직후의 위치도 기록해 이후 도구 클릭 시 이전 선택 범위를 쓰지 않는다.
            selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
            onChange(event.target.value);
          }}
          onSelect={(event) => {
            selection.current = { start: event.currentTarget.selectionStart, end: event.currentTarget.selectionEnd };
          }}
          disabled={disabled} rows={14} placeholder="설명을 적고, 필요한 위치에 코드블록을 추가하세요." />
      </>}
      {preview && <div className="editor-preview" aria-label="본문 미리보기">
        {content.trim()
          ? <Suspense fallback={<p>미리보기를 준비하고 있습니다...</p>}><Preview content={content} /></Suspense>
          : <p className="post-help">작성한 내용이 여기에 표시됩니다.</p>}
      </div>}
      <details className="post-help">
        <summary>작성 도움말</summary>
        <p>본문은 Markdown으로 저장됩니다. 버튼으로 서식을 넣거나 직접 작성할 수 있습니다. 코드블록마다 다른 언어를 지정할 수 있으며, 삽입 후 첫 줄의 언어 이름을 수정할 수 있습니다. 미리보기는 상세 화면과 같은 방식으로 표시됩니다.</p>
        <p>이미지는 아래 첨부 영역에서 선택합니다. 첨부 이미지는 등록 후 본문 위에 표시됩니다.</p>
      </details>
    </section>
  );
};
