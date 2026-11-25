import styles from './CodeBlock.module.css';
import { useContext, type ChangeEvent } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { CODE_LANGUAGES } from './codeFormatting';
import { RichTextEditorDisabledContext } from './RichTextEditorContext';

/**
 * 편집기 안의 코드블록 하나를 표시한다. 위쪽 바는 편집 대상에서 제외하고 코드만 입력받는다.
 * 언어는 별도 React 상태가 아니라 해당 문서 노드의 속성이므로 저장/복원/실행 취소에 포함된다.
 */
export const CodeBlockEditor = ({ node, updateAttributes, editor }: NodeViewProps) => {
  const disabled = useContext(RichTextEditorDisabledContext);
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
    <NodeViewWrapper className={styles.block} data-code-block-editor="">
      <div className={styles.bar} contentEditable={false}>
        <span>코드블록</span>
        {/* Tiptap의 핸들은 드래그 시작 시 이 블록 전체를 NodeSelection으로 지정한다.
            코드 내용·언어 메뉴와 분리해 일부 코드나 다른 블록이 잘못 이동하지 않게 한다. */}
        <span className={styles.dragHandle} data-drag-handle="" draggable={!disabled && editor.isEditable}
          aria-disabled={disabled || !editor.isEditable} title="끌어서 코드블록 전체 이동">⠿ 전체 이동</span>
        <label className={styles.language}>언어
          <select className={styles.control} aria-label="코드블록 언어" value={language} disabled={disabled}
            onChange={changeLanguage}>
            {/* 붙여넣은 기존 코드에 다른 언어 이름이 있어도 선택 메뉴가 빈 값으로 보이지 않게 한다. */}
            {!knownLanguage && <option value={language}>{language}</option>}
            {CODE_LANGUAGES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      {/* NodeViewContent만 문서에 연결하므로 언어 메뉴 문구는 본문에 저장되지 않는다.
          라이브러리가 기본으로 넣는 인라인 pre-wrap을 pre로 바꿔 긴 코드 줄을 보존한다. */}
      <pre><NodeViewContent<'code'> as="code" className={`language-${language}`} style={{ whiteSpace: 'pre' }} /></pre>
    </NodeViewWrapper>
  );
};
