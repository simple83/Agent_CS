import { type Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { common, createLowlight } from 'lowlight';
import { codeFence, inlineCode } from './postEditor';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CodeBlockEditor } from '../components/CodeBlockEditor';

// 상세 화면과 같은 언어 해석기를 사용한다. JSX/TSX는 각각 JS/TS 문법으로 표시한다.
const lowlight = createLowlight(common);
lowlight.registerAlias({ javascript: ['jsx'], typescript: ['tsx'] });

// 문서 구조/하이라이트는 기존 확장을 유지하고 편집 화면의 코드블록 외형만 교체한다.
const VisualCodeBlock = CodeBlockLowlight.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockEditor);
  },
});

/** 웹 주소만 허용하고 실행 가능한 스킴은 거부한다. 링크 입력과 HTML 붙여넣기에 공유한다. */
export const isWebLink = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};

/**
 * 상세 렌더러가 지원하는 Markdown 서식만 활성화한다. 이미지 노드는 등록하지 않아
 * 기존 첨부 API와 본문 편집을 섞지 않는다. 편집기마다 독립된 확장 설정을 반환한다.
 */
export const createVisualEditorExtensions = () => [
  StarterKit.configure({
    codeBlock: false,
    strike: false,
    underline: false,
    heading: { levels: [2, 3] },
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: (url) => isWebLink(url),
    },
  }),
  VisualCodeBlock.configure({
    lowlight: {
      ...lowlight,
      // 알 수 없는 언어도 자동 추측하지 않는다. 일반 텍스트와 같은 표시로 유지한다.
      highlightAuto: (value: string) => lowlight.highlight('plaintext', value),
    },
    defaultLanguage: 'text',
  }),
  Markdown.configure({ markedOptions: { gfm: false } }),
];

/** 인라인 코드 구분자에 필요한 패딩을 계산해 실제 양끝 공백과 백틱을 보존한다. */
const inlineCodeEdge = (text: string, side: 'open' | 'close'): string => {
  const wrapped = inlineCode(text);
  const size = (wrapped.length - text.length) / 2;
  return side === 'open' ? wrapped.slice(0, size) : wrapped.slice(-size);
};

/**
 * Tiptap의 기본 Markdown 출력은 코드 마크의 양끝 공백을 밖으로 옮긴다.
 * 저장에는 ProseMirror의 직렬화기를 사용하고, 노드 이름과 코드 경계를 앱 규칙에 맞춘다.
 * 알 수 없는 노드는 조용히 버리지 않고 오류로 알리는 기본 strict 설정을 유지한다.
 */
const serializer = new MarkdownSerializer({
  paragraph(state, node) {
    // 공백 엔티티로 빈 문단을 보존한다. 실제 공백은 API 전송 전 trim()에서 사라질 수 있다.
    if (node.content.size === 0) state.write('&nbsp;');
    else state.renderInline(node);
    state.closeBlock(node);
  },
  text: defaultMarkdownSerializer.nodes.text,
  heading: defaultMarkdownSerializer.nodes.heading,
  blockquote: defaultMarkdownSerializer.nodes.blockquote,
  bulletList: defaultMarkdownSerializer.nodes.bullet_list,
  listItem: defaultMarkdownSerializer.nodes.list_item,
  horizontalRule: defaultMarkdownSerializer.nodes.horizontal_rule,
  hardBreak(state, _node, parent, index) {
    // 문단 끝에도 눈에 보이지 않는 문자를 두어 마지막 개행이 trim()으로 지워지지 않게 한다.
    state.write('\\\n');
    if (index === parent.childCount - 1) state.write('&nbsp;');
  },
  orderedList(state, node) {
    const start = node.attrs.start ?? 1;
    const width = String(start + node.childCount - 1).length;
    state.renderList(node, ' '.repeat(width + 2), (index) => `${String(start + index).padStart(width)}. `);
  },
  codeBlock(state, node) {
    // 닫는 구분자 전용 개행을 따로 추가해 코드의 마지막 빈 줄까지 보존한다.
    // text()는 인용/목록 속 코드에도 각 줄의 들여쓰기 접두사를 붙여 준다.
    state.text(codeFence(`${node.textContent}\n`, node.attrs.language ?? 'text'), false);
    state.closeBlock(node);
  },
}, {
  bold: defaultMarkdownSerializer.marks.strong,
  italic: defaultMarkdownSerializer.marks.em,
  link: defaultMarkdownSerializer.marks.link,
  code: {
    open: (_state, _mark, parent, index) => inlineCodeEdge(parent.child(index).textContent, 'open'),
    close: (_state, _mark, parent, index) => inlineCodeEdge(parent.child(index - 1).textContent, 'close'),
    escape: false,
  },
}, { hardBreakNodeName: 'hardBreak' });

/** 공백만 있는 문서는 빈 문자열로 보내 기존 필수 본문 검증을 그대로 사용한다. */
export const serializeVisualEditor = (editor: Editor): string =>
  editor.state.doc.textContent.trim() ? serializer.serialize(editor.state.doc) : '';
