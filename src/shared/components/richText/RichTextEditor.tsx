import { useEffect, useId, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import { RichTextEditorDisabledContext } from './RichTextEditorContext';
import { createVisualEditorExtensions, insertCodeBlockBelow, isWebLink, serializeVisualEditor } from './visualEditor';
import { selectedImage, canReplaceImage, replaceImage, addParagraphAfterImage, deleteSelectedImage, type ImageReplacementTarget } from './imageEditing';
import styles from './RichTextEditor.module.css';
import richText from './RichText.module.css';
import syntax from './CodeSyntax.module.css';
import ui from '../../styles/Controls.module.css';

interface RichTextEditorProps {
  /** 부모는 API에 전송할 Markdown을 보관하고 편집기는 구조화된 문서를 관리한다. */
  content: string;
  /** 선택 파일을 부모 폼에 보관한다. 교체 시 기존 src도 전달해 업로드 개수에서 교체분을 제외한다. */
  onImageFiles?: (files: File[], replacingSrc?: string) => { src: string; alt: string }[];
  onChange: (content: string) => void;
  disabled: boolean;
  /** 댓글 등 이미지가 없는 입력창에서는 파일 선택 안내를 표시하지 않는다. */
  imageAttachmentAvailable?: boolean;
  /** 여러 댓글 폼을 함께 열어도 접근성 이름과 링크 입력 ID가 충돌하지 않게 구분한다. */
  label?: string;
  compact?: boolean;
  /** 댓글은 텍스트·코드블록만 사용한다. 편집기 마운트 후에는 용도를 변경하지 않는다. */
  variant?: 'post' | 'comment';
}

/**
 * 서식이 적용된 본문을 직접 수정하는 Boundary 컴포넌트다.
 * 입력할 때마다 Markdown만 부모에게 전달하고 문서를 다시 만들지 않는다.
 * 이 구분이 커서 위치, 한글 조합 입력, 실행 취소 이력을 유지하는 핵심이다.
 */
export const RichTextEditor = ({ content, onChange, disabled, imageAttachmentAvailable = true, label = '게시글 내용', compact = false, variant = 'post', onImageFiles }: RichTextEditorProps) => {
  const imageInput = useRef<HTMLInputElement>(null);
  const replacementInput = useRef<HTMLInputElement>(null);
  const replacementTarget = useRef<ImageReplacementTarget | null>(null);
  const linkPanelId = useId();
  const lastPublished = useRef(content);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [message, setMessage] = useState('');
  // 확장 설정은 최초 한 번만 만든다. 본문 입력마다 언어/문법 설정을 다시 구성하지 않는다.
  const [extensions] = useState(() => createVisualEditorExtensions(variant));

  const editor = useEditor({
    extensions,
    content,
    contentType: 'markdown',
    editable: !disabled,
    editorProps: {
      attributes: {
        class: `${richText.body} ${syntax.syntax} ${styles.body} ${compact ? styles.compact : ''}`,
        role: 'textbox',
        'aria-label': label,
        'aria-multiline': 'true',
      },
      // 파일은 이미지 도구 버튼으로 안내한다. 일반 텍스트와 HTML 서식은 문서 규칙으로 처리한다.
      handlePaste: (_view, event) => {
        if (!event.clipboardData?.files.length) return false;
        setMessage(imageAttachmentAvailable ? '이미지는 도구 모음의 이미지 버튼에서 선택해 주세요.' : '이 입력창에서는 이미지 추가·교체를 지원하지 않습니다.');
        return true;
      },
      handleDrop: (view, event) => {
        // 같은 편집기에서 시작한 드래그만 원본 노드로 이동한다. URL 재삽입이나 새 업로드를 하지 않는다.
        if (view.dragging) {
          let hasImage = false;
          let hasCode = false;
          view.dragging.slice.content.descendants((node) => {
            if (node.type.name === 'image') hasImage = true;
            if (node.type.name === 'codeBlock') hasCode = true;
          });
          if (hasImage || hasCode) {
            if (disabled || !view.editable) return true;
            const target = view.posAtCoords({ left: event.clientX, top: event.clientY });
            if (target && view.state.doc.resolve(target.pos).parent.type.spec.code) {
              setMessage(hasCode ? '코드블록은 다른 코드블록 바깥으로 옮겨주세요.' : '이미지는 코드블록 바깥으로 옮겨주세요.');
              return true;
            }
            // 기본 이동 동작이 원래 노드를 제거하고 새 위치에 넣으며 실행 취소도 한 번으로 처리한다.
            return false;
          }
        }
        if (!event.dataTransfer?.files.length) return false;
        setMessage(imageAttachmentAvailable ? '이미지는 도구 모음의 이미지 버튼에서 선택해 주세요.' : '이 입력창에서는 이미지 추가·교체를 지원하지 않습니다.');
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
      image: selectedImage(current),
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

  /** 버튼 클릭으로 잃은 본문 포커스를 새 코드블록으로 돌려 즉시 코드를 입력할 수 있게 한다. */
  const addCodeBlock = () => {
    if (disabled || !editor.commands.command(insertCodeBlockBelow)) return;
    editor.view.focus();
  };

  /** 파일 선택창으로 포커스가 옮겨져도 교체 대상을 고정한다. 취소하면 본문은 변경되지 않는다. */
  const chooseReplacement = () => {
    const image = selectedImage(editor);
    if (disabled || !editor.isEditable || !image) return;
    replacementTarget.current = { position: image.position, src: image.src, document: editor.state.doc };
    replacementInput.current?.click();
  };

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
    <section className={styles.editor} aria-label="본문 편집기" onDragStartCapture={(event) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      const codeBlock = target?.closest('[data-code-block-editor]');
      // NodeView가 기본 이벤트를 가로채기 전에 검사한다. 핸들은 이후 Tiptap이 블록 전체를 선택한다.
      if (!disabled && editor.isEditable && codeBlock && target?.closest('[data-drag-handle]')) return;

      const { selection, doc } = editor.state;
      let includesCode = Boolean(codeBlock);
      // 일반 문단부터 코드 일부까지 걸친 선택도 바깥에서 끌어 분리할 수 없게 한다.
      doc.nodesBetween(selection.from, selection.to, (node) => {
        if (node.type.name === 'codeBlock') includesCode = true;
      });
      if (!includesCode) return;

      // 드래그만 막고 선택 범위는 유지한다. 복사·잘라내기·키보드 편집에는 영향을 주지 않는다.
      event.preventDefault();
      event.stopPropagation();
      setMessage('코드블록은 상단의 전체 이동 핸들을 끌어서 옮겨주세요.');
    }}>
      {/* 모든 도구는 type=button으로 선언해 부모 폼을 제출하지 않는다. */}
      <div className={styles.toolbar} role="group" aria-label="본문 서식 도구">
        {variant === 'post' && <>
        {onImageFiles && <>
          <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled || state.codeBlock}
            onClick={() => imageInput.current?.click()}>이미지</button>
          <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple hidden
            aria-label="본문 이미지 선택" disabled={disabled} onChange={(event) => {
              // 삽입은 선택 범위 뒤에 수행한다. 기존 이미지/글자를 교체하는 기능과 구분한다.
              try {
                if (disabled || !editor.isEditable || !event.target.files?.length) return;
                const items = onImageFiles(Array.from(event.target.files ?? []));
                editor.chain().setTextSelection(editor.state.selection.to).insertContent(items.flatMap((attrs) => [
                  { type: 'image', attrs }, { type: 'text', text: ' ' },
                ])).run();
                editor.view.focus();
                setMessage('이미지를 클릭하면 교체·삭제하거나 이미지 아래에 글을 쓸 수 있습니다.');
              } catch (error) { setMessage(error instanceof Error ? error.message : '이미지를 추가하지 못했습니다.'); }
              finally { event.target.value = ''; }
            }} />
          <input ref={replacementInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden
            aria-label="교체할 이미지 선택" disabled={disabled} onChange={(event) => {
              const target = replacementTarget.current;
              replacementTarget.current = null;
              try {
                const files = Array.from(event.target.files ?? []);
                if (!files.length) return;
                if (disabled || !target || !canReplaceImage(editor, target)) {
                  setMessage('본문이 변경되었습니다. 교체할 이미지를 다시 선택해주세요.');
                  return;
                }
                if (files.length !== 1) throw new Error('교체할 이미지는 한 개만 선택해주세요.');
                const [attrs] = onImageFiles(files, target.src);
                if (!attrs || !replaceImage(editor, target, attrs)) throw new Error('이미지를 다시 선택한 뒤 교체해주세요.');
                editor.view.focus();
                setMessage('이미지를 교체했습니다. 게시글을 저장하면 반영됩니다.');
              } catch (error) { setMessage(error instanceof Error ? error.message : '이미지 교체에 실패했습니다.'); }
              finally { event.target.value = ''; }
            }} />
        </>}
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled || !state.undo} onClick={() => editor.chain().focus().undo().run()}>실행 취소</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled || !state.redo} onClick={() => editor.chain().focus().redo().run()}>다시 실행</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled || state.codeBlock} aria-pressed={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}>굵게</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled || state.codeBlock} aria-pressed={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>기울임</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled || state.codeBlock} aria-pressed={state.code} onClick={() => editor.chain().focus().toggleCode().run()}>인라인 코드</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled || state.codeBlock} aria-pressed={state.link} aria-expanded={showLink} aria-controls={linkPanelId} onClick={openLink}>링크</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled} aria-pressed={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}>목록</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled} aria-pressed={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}>번호 목록</button>
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled} aria-pressed={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>인용</button>
        </>}
        {/* 토글이 아닌 삽입 동작이다. 원문을 코드로 바꾸거나 이미 작성한 코드를 해제하지 않는다. */}
        <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled} onClick={addCodeBlock}>코드블록</button>
        {state.codeBlock && <button className={`${ui.button} ${styles.toolButton}`} type="button" disabled={disabled} onClick={() => editor.chain().focus().exitCode().run()}>코드 아래에 문단 추가</button>}
      </div>

      {variant === 'post' && state.image && <div className={styles.imageTools} role="group" aria-label="선택한 이미지 편집">
        <span className={styles.imageName}>{state.image.alt || '선택한 이미지'}</span>
        {onImageFiles && <button type="button" className={ui.button} disabled={disabled} onClick={chooseReplacement}>이미지 교체</button>}
        <button type="button" className={ui.button} disabled={disabled} onClick={() => {
          if (!disabled && deleteSelectedImage(editor)) {
            editor.view.focus();
            setMessage('본문에서 이미지를 제거했습니다. 실행 취소로 되돌릴 수 있습니다.');
          }
        }}>이미지 삭제</button>
        <button type="button" className={ui.button} disabled={disabled} onClick={() => {
          if (!disabled && addParagraphAfterImage(editor)) {
            editor.view.focus();
            setMessage('이미지 아래에서 글을 이어 쓸 수 있습니다.');
          }
        }}>이미지 아래에 글쓰기</button>
      </div>}

      {variant === 'post' && showLink && <fieldset id={linkPanelId} className={styles.linkPanel} disabled={disabled}>
        <legend>링크 설정</legend>
        <label className={ui.field}>웹 주소
          <input className={ui.input} type="url" value={linkUrl} placeholder="https://example.com"
            onChange={(event) => setLinkUrl(event.target.value)}
            onKeyDown={(event) => {
              // 주소 입력의 Enter가 게시글 전체를 등록하지 않도록 여기서 처리한다.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault();
                applyLink();
              }
            }} />
        </label>
        <div className={`${ui.actions} ${styles.linkActions}`}>
          <button className={`${ui.button} ${styles.toolButton}`} type="button" onClick={() => { setShowLink(false); setMessage(''); }}>닫기</button>
          <button className={`${ui.button} ${styles.toolButton}`} type="button" onClick={() => { editor.chain().focus().extendMarkRange('link').unsetLink().run(); setShowLink(false); }}>링크 제거</button>
          <button className={`${ui.button} ${styles.toolButton}`} type="button" onClick={applyLink}>적용</button>
        </div>
      </fieldset>}

      {message && <p className={styles.message} role="status">{message}</p>}
      <div className={styles.label}>{label} *</div>
      <RichTextEditorDisabledContext.Provider value={disabled}>
        <EditorContent editor={editor} />
      </RichTextEditorDisabledContext.Provider>
    </section>
  );
};
