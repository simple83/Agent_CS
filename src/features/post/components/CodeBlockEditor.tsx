import { useContext, type ChangeEvent } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { CODE_LANGUAGES } from '../utils/postEditor';
import { PostEditorDisabledContext } from './PostEditorContext';

/**
 * 편집기 안의 코드블록 하나를 표시한다. 위쪽 바는 편집 대상에서 제외하고 코드만 입력받는다.
 * 언어는 별도 React 상태가 아니라 해당 문서 노드의 속성이므로 저장/복원/실행 취소에 포함된다.
 */
export const CodeBlockEditor = ({ node, updateAttributes, editor }: NodeViewProps) => {
  const disabled = useContext(PostEditorDisabledContext);
  const language = node.attrs.language || 'text';
  const knownLanguage = CODE_LANGUAGES.some(([value]) => value === language);

  /** 현재 커서가 다른 블록에 있어도 이 메뉴가 소속된 코드블록의 언어만 변경한다. */
  const changeLanguage = (event: ChangeEvent<HTMLSelectElement>) => {
    if (disabled || !editor.isEditable) return;
    const value = event.target.value;
    if (CODE_LANGUAGES.some(([allowed]) => allowed === value)) {
      updateAttributes({ language: value });
    }
  };

  return (
    <NodeViewWrapper className="editor-code-block">
      <div className="editor-code-bar" contentEditable={false}>
        <span>코드블록</span>
        <label className="editor-code-language">언어
          <select aria-label="코드블록 언어" value={language} disabled={disabled}
            onChange={changeLanguage}>
            {/* 붙여넣은 기존 코드에 다른 언어 이름이 있어도 선택 메뉴가 빈 값으로 보이지 않게 한다. */}
            {!knownLanguage && <option value={language}>{language}</option>}
            {CODE_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {/* NodeViewContent만 문서에 연결하므로 언어 메뉴의 문구는 Markdown 본문에 저장되지 않는다. */}
      <pre><NodeViewContent<'code'> as="code" className={`language-${language}`} style={{ whiteSpace: 'pre' }} /></pre>
    </NodeViewWrapper>
  );
};
