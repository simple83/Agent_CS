import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { PostEditorDisabledContext } from './PostEditorContext';
import { createVisualEditorExtensions, isWebLink, serializeVisualEditor } from '../utils/visualEditor';
import 'highlight.js/styles/github-dark.css';
import './PostContent.css';
import './PostEditor.css';

interface PostEditorProps {
  /** 부모는 API에 전송할 Markdown을 보관하고 편집기는 구조화된 문서를 관리한다. */
  content: string;
  onChange: (content: string) => void;
  disabled: boolean;
}

/**
 * 서식이 적용된 본문을 직접 수정하는 Boundary 컴포넌트다.
 * 입력할 때마다 Markdown만 부모에게 전달하고 문서를 다시 만들지 않는다.
 * 이 구분이 커서 위치, 한글 조합 입력, 실행 취소 이력을 유지하는 핵심이다.
 */
export const PostEditor = ({ content, onChange, disabled }: PostEditorProps) => {
  const lastPublished = useRef(content);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [message, setMessage] = useState('');
  // 확장 설정은 최초 한 번만 만든다. 본문 입력마다 언어/문법 설정을 다시 구성하지 않는다.
  const [extensions] = useState(createVisualEditorExtensions);

  const editor = useEditor({
    extensions,
    content,
    contentType: 'markdown',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: 'post-content visual-editor-body',
        role: 'textbox',
        'aria-label': '게시글 내용',
        'aria-multiline': 'true',
        'aria-describedby': 'visual-editor-help',
      },
      // 파일은 기존 첨부 절차로 안내한다. 일반 텍스트와 HTML 서식은 문서 규칙으로 처리한다.
      handlePaste: (_view, event) => {
        if (!event.clipboardData?.files.length) return false;
        setMessage('이미지는 아래 이미지 첨부에서 선택해 주세요.');
        return true;
      },
      handleDrop: (_view, event) => {
        if (!event.dataTransfer?.files.length) return false;
        setMessage('이미지는 아래 이미지 첨부에서 선택해 주세요.');
        return true;
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = serializeVisualEditor(current);
      lastPublished.current = markdown;
      onChange(markdown);
    },
  });

  // 선택 위치에 따라 공통 서식 버튼의 눌림 상태를 갱신한다. 언어는 각 코드블록이 관리한다.
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => current ? {
      bold: current.isActive('bold'),
      italic: current.isActive('italic'),
      code: current.isActive('code'),
      codeBlock: current.isActive('codeBlock'),
      bulletList: current.isActive('bulletList'),
      orderedList: current.isActive('orderedList'),
      blockquote: current.isActive('blockquote'),
      link: current.isActive('link'),
      undo: current.can().undo(),
      redo: current.can().redo(),
    } : null,
  });

  // 저장 중에는 본문도 읽기 전용으로 만든다. 상태 변경 자체를 본문 수정으로 알리지 않는다.
  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  // 외부 초기화에만 문서를 교체한다. 입력에 따른 부모 렌더는 건너뛰어 조합 입력을 보존한다.
  useEffect(() => {
    if (!editor || content === lastPublished.current) return;
    lastPublished.current = content;
    editor.commands.setContent(content, { contentType: 'markdown', emitUpdate: false });
  }, [editor, content]);

  if (!editor || !state) return <p role="status">본문 편집기를 준비하고 있습니다...</p>;

  /** 링크 패널로 포커스가 이동해도 선택 범위는 유지된다. 기존 링크는 수정할 수 있다. */
  const openLink = () => {
    setLinkUrl(editor.getAttributes('link').href ?? '');
    setMessage('');
    setShowLink(!showLink);
  };

  /** 선택 문자열에 링크를 적용한다. 선택이 없으면 주소 자체를 표시할 텍스트로 넣는다. */
  const applyLink = () => {
    const input = linkUrl.trim();
    if (!isWebLink(input)) {
      setMessage('http:// 또는 https://로 시작하는 올바른 웹 주소를 입력해 주세요.');
      return;
    }
    // 공백/한글이 포함된 경로를 URL 표준 표현으로 바꿔 Markdown 링크도 정상 해석되게 한다.
    const href = new URL(input).href;
    const chain = editor.chain().focus().extendMarkRange('link');
    if (editor.state.selection.empty && !editor.isActive('link')) {
      chain.insertContent({ type: 'text', text: href, marks: [{ type: 'link', attrs: { href } }] }).run();
    } else {
      chain.setLink({ href }).run();
    }
    setShowLink(false);
    setMessage('');
  };

  return (
    <section className="post-editor" aria-label="본문 편집기">
      {/* 모든 도구는 type=button으로 선언해 부모 폼을 제출하지 않는다. */}
      <div className="editor-toolbar" role="group" aria-label="본문 서식 도구">
        <button type="button" disabled={disabled || !state.undo} onClick={() => editor.chain().focus().undo().run()}>실행 취소</button>
        <button type="button" disabled={disabled || !state.redo} onClick={() => editor.chain().focus().redo().run()}>다시 실행</button>
        <button type="button" disabled={disabled || state.codeBlock} aria-pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>굵게</button>
        <button type="button" disabled={disabled || state.codeBlock} aria-pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>기울임</button>
        <button type="button" disabled={disabled || state.codeBlock} aria-pressed={state.code} onClick={() => editor.chain().focus().toggleCode().run()}>인라인 코드</button>
        <button type="button" disabled={disabled || state.codeBlock} aria-pressed={state.link} aria-expanded={showLink} aria-controls="editor-link-panel" onClick={openLink}>링크</button>
        <button type="button" disabled={disabled} aria-pressed={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>목록</button>
        <button type="button" disabled={disabled} aria-pressed={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>번호 목록</button>
        <button type="button" disabled={disabled} aria-pressed={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>인용</button>
        <button type="button" disabled={disabled} aria-pressed={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock({ language: 'text' }).run()}>코드블록</button>
        {state.codeBlock && <button type="button" disabled={disabled} onClick={() => editor.chain().focus().exitCode().run()}>코드 아래에 문단 추가</button>}
      </div>

      {showLink && <fieldset id="editor-link-panel" className="editor-link-panel" disabled={disabled}>
        <legend>링크 설정</legend>
        <label>웹 주소
          <input type="url" value={linkUrl} placeholder="https://example.com"
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              // 주소 입력의 Enter가 게시글 전체를 등록하지 않도록 여기서 처리한다.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                applyLink();
              }
            }} />
        </label>
        <div className="post-actions">
          <button type="button" onClick={() => { setShowLink(false); setMessage(''); }}>닫기</button>
          <button type="button" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setShowLink(false); }}>링크 제거</button>
          <button type="button" onClick={applyLink}>적용</button>
        </div>
      </fieldset>}

      {message && <p className="editor-message" role="status">{message}</p>}
      <div className="post-body-label">내용 *</div>
      <PostEditorDisabledContext.Provider value={disabled}>
        <EditorContent editor={editor} />
      </PostEditorDisabledContext.Provider>

      <details className="post-help" id="visual-editor-help">
        <summary>작성 도움말</summary>
        <p>내용을 바로 입력하고 선택한 글자에 서식을 적용하세요. 각 코드블록 상단 바의 오른쪽에서 언어를 선택합니다. 코드 안에 커서를 둔 뒤 코드 아래에 문단 추가 버튼으로 설명을 이어 쓸 수 있습니다.</p>
        <p>Enter는 새 문단, Shift+Enter는 줄바꿈입니다. 코드 안에서는 Enter로 코드 줄을 바꿉니다. 실행 취소는 Ctrl+Z(맥은 ⌘Z)로도 가능합니다.</p>
        <p>이미지는 아래 첨부 영역에서 선택합니다. 첨부 이미지는 등록 후 본문 위에 표시됩니다.</p>
      </details>
    </section>
  );
};
