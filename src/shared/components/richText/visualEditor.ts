import { imageMarkdown, isImageUrl } from './markdownImages';
import { Node as TiptapNode, Extension, type Command, type Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { closeHistory } from '@tiptap/pm/history';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { MarkdownSerializer, defaultMarkdownSerializer } from 'prosemirror-markdown';
import { common, createLowlight } from 'lowlight';
import { codeFence, inlineCode } from './codeFormatting';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CodeBlockEditor } from './CodeBlockEditor';

// 상세 화면과 같은 언어 해석기를 사용한다. JSX/TSX는 각각 JS/TS 문법으로 표시한다.
const lowlight = createLowlight(common);
lowlight.registerAlias({ javascript: ['jsx'], typescript: ['tsx'] });

// 문서 구조/하이라이트는 기존 확장을 유지하고 편집 화면의 코드블록 외형만 교체한다.
const VisualCodeBlock = CodeBlockLowlight.extend({
  // 상단 이동 핸들이 블록 전체를 선택한 뒤 이동한다. 내부 텍스트 드래그는 편집기에서 차단한다.
  draggable: true,

  // Markdown 해석기가 이미 코드로 판정한 토큰을 사용한다. 원본 구분자 앞에 공백이 있는
  // 목록 내부 코드도 허용하고, 실제 코드의 들여쓰기는 token.text 그대로 보존한다.
  parseMarkdown: (token, helpers) => helpers.createNode(
    'codeBlock',
    { language: token.lang || 'text' },
    token.text ? [helpers.createTextNode(token.text)] : [],
  ),

  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockEditor);
  },

  // 코드 삽입 단축키도 버튼과 동일하게 기존 문단을 보존한다. 그 외 코드 내 Enter/Tab 동작은 유지한다.
  addKeyboardShortcuts() {
    return { ...this.parent?.(), 'Mod-Alt-c': () => this.editor.commands.command(insertCodeBlockBelow) };
  },
});

/**
 * 선택한 글자를 코드로 변환하지 않고 현재 문단 아래에 새 코드블록을 넣는다.
 * 문단 중간 커서·범위 선택에도 원문 전체를 보존하며, 목록/인용에서는 코드가 허용되는
 * 가장 가까운 부모 안에 삽입한다. 코드 내부에서는 기존 코드 다음에 별도 블록을 만든다.
 * 삽입과 커서 이동을 한 트랜잭션으로 처리해 실행 취소 한 번으로 원상 복구할 수 있게 한다.
 */
export const insertCodeBlockBelow: Command = ({ editor, tr, state, dispatch }) => {
  if (!editor.isEditable) return false;
  const codeType = state.schema.nodes.codeBlock;
  const paragraphType = state.schema.nodes.paragraph;
  const { $to } = tr.selection;
  let depth = $to.depth;
  let position = $to.pos;

  // listItem은 코드블록을 담을 수 있지만 bulletList 자체는 담을 수 없으므로 부모의 스키마를 확인한다.
  while (depth > 0) {
    const parent = $to.node(depth - 1);
    const index = $to.indexAfter(depth - 1);
    if (parent.canReplaceWith(index, index, codeType)) {
      position = $to.after(depth);
      break;
    }
    depth -= 1;
  }
  const boundary = tr.doc.resolve(position);
  if (!boundary.parent.canReplaceWith(boundary.index(), boundary.index(), codeType)) return false;
  if (!dispatch) return true;

  const block = codeType.create({ language: 'text' });
  closeHistory(tr);
  tr.insert(position, block);
  // 뒤에 일반 문단이 없으면 함께 만들어 코드 뒤에 설명을 이어 쓸 수 있게 한다.
  const afterCode = position + block.nodeSize;
  if (tr.doc.resolve(afterCode).nodeAfter?.type !== paragraphType) tr.insert(afterCode, paragraphType.create());
  tr.setSelection(TextSelection.create(tr.doc, position + 1));
  tr.setStoredMarks([]);
  tr.scrollIntoView();
  return true;
};

/** 웹 주소만 허용하고 실행 가능한 스킴은 거부한다. 링크 입력과 HTML 붙여넣기에 공유한다. */
export const isWebLink = (value: string): boolean => {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
};

/**
 * 이전 댓글의 서식을 제거해 읽되 내용은 보존하는 Markdown 입력 전용 확장이다.
 * 비활성화한 노드의 기본 파서에 맡기면 인라인 코드·목록이 누락되거나 제목 노드가
 * 없는 스키마에 전달될 수 있다. 새 서식 도구나 단축키를 등록하지 않고 일반 문단으로 변환한다.
 */
const commentMarkdownReaders = [
  Extension.create({
    name: 'commentPlainInlineCode',
    markdownTokenName: 'codespan',
    parseMarkdown: (token) => token.text ? { type: 'text', text: token.text } : [],
  }),
  Extension.create({
    name: 'commentPlainHeading',
    markdownTokenName: 'heading',
    parseMarkdown: (token, helpers) => ({ type: 'paragraph', content: helpers.parseInline(token.tokens ?? []) }),
  }),
  Extension.create({
    name: 'commentPlainList',
    markdownTokenName: 'list',
    parseMarkdown: (token, helpers) => {
      // 목록 항목의 첫 줄은 paragraph 대신 text 토큰이다. 문단으로 감싸야 글자와 줄 경계가 유지된다.
      // 중첩 목록과 코드블록은 같은 파서를 재귀적으로 거쳐 순서와 코드 언어를 유지한다.
      const blocks = (token.items ?? []).flatMap((item) => (item.tokens ?? []).map((child) =>
        child.type === 'text' ? {
          ...child,
          type: 'paragraph',
          tokens: child.tokens ?? [{ type: 'text', text: child.text ?? '' }],
        } : child,
      ));
      return helpers.parseChildren(blocks);
    },
  }),
];

/**
 * 본문 이미지 노드. 서버 Markdown과 명시적 파일 선택만 허용하고 HTML 붙여넣기의 img는 읽지 않는다.
 * 댓글 스키마에는 등록하지 않으므로 게시글의 이미지 기능이 댓글로 확장되지 않는다.
 */
const PostImageNode = TiptapNode.create({
  // 내부 드래그는 편집기가 보관한 노드 조각을 이동하므로 외부 HTML 이미지 허용과 무관하다.
  name: 'image', inline: true, group: 'inline', atom: true, draggable: true,
  addAttributes: () => ({ src: { default: '' }, alt: { default: '' } }),
  parseHTML: () => [],
  renderHTML: ({ HTMLAttributes }) => ['img', {
    src: isImageUrl(HTMLAttributes.src, true) ? HTMLAttributes.src : undefined,
    alt: HTMLAttributes.alt, referrerpolicy: 'no-referrer',
  }],
  markdownTokenName: 'image',
  parseMarkdown: (token) => isImageUrl(String(token.href ?? ''), true)
    ? { type: 'image', attrs: { src: token.href, alt: token.text ?? '' } }
    : { type: 'text', text: String(token.text || '이미지 주소를 확인해주세요.') },
});

/**
 * 기본 문단 파서는 이미지 하나만 있으면 블록 이미지로 간주하고 문단을 없앤다.
 * 여기서는 문장 사이에도 삽입하는 인라인 이미지이므로 문단을 유지해야 위치·줄바꿈이 보존된다.
 * 나머지 문단은 기본 파서에 맡겨 빈 문단 표시 등 기존 규칙을 그대로 사용한다.
 */
const InlineImageParagraph = Extension.create({
  name: 'inlineImageParagraph',
  priority: 1100,
  markdownTokenName: 'paragraph',
  parseMarkdown: (token, helpers) => token.tokens?.length === 1 && token.tokens[0].type === 'image'
    ? helpers.createNode('paragraph', undefined, helpers.parseInline(token.tokens))
    : [],
});

/**
 * 상세 렌더러가 지원하는 Markdown 서식만 활성화한다. 이미지는 게시글에만 등록한다. 댓글은 일반 문단과 코드블록만 제공하며,
 * 버튼 숨김뿐 아니라 다른 서식의 단축키·입력 규칙·붙여넣기 서식도 비활성화한다.
 * 실행 취소 이력은 기본 텍스트 편집을 위해 유지하되 댓글 도구 모음에는 노출하지 않는다.
 */
export const createVisualEditorExtensions = (variant: 'post' | 'comment' = 'post') => [
  StarterKit.configure({
    codeBlock: false,
    strike: false,
    underline: false,
    bold: variant === 'comment' ? false : {},
    italic: variant === 'comment' ? false : {},
    code: variant === 'comment' ? false : {},
    blockquote: variant === 'comment' ? false : {},
    bulletList: variant === 'comment' ? false : {},
    orderedList: variant === 'comment' ? false : {},
    listItem: variant === 'comment' ? false : {},
    listKeymap: variant === 'comment' ? false : {},
    horizontalRule: variant === 'comment' ? false : {},
    heading: variant === 'comment' ? false : { levels: [2, 3] },
    link: variant === 'comment' ? false : {
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
  ...(variant === 'comment' ? commentMarkdownReaders : [PostImageNode, InlineImageParagraph]),
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
  image(state, node) { state.write(imageMarkdown(node.attrs.alt ?? '', node.attrs.src)); },
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
export const serializeVisualEditor = (editor: Editor): string => {
  let hasImage = false;
  editor.state.doc.descendants((node) => { if (node.type.name === 'image') hasImage = true; });
  return editor.state.doc.textContent.trim() || hasImage ? serializer.serialize(editor.state.doc) : '';
};
